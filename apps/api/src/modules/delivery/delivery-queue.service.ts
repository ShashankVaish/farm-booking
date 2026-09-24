import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import { BackgroundWork } from '../../common/background-work.service';
import type { OutboundEmail } from '../mail/mail-transport.interface';
import { MailService } from '../mail/mail.service';
import {
  WhatsAppService,
  type WhatsAppTemplate,
} from '../notifications/whatsapp.service';

/*
  Outgoing email and WhatsApp, through a Redis job queue (BullMQ).

  The request that causes a message (a booking, a payment return, a refund)
  only puts a job in Redis — about a millisecond — and answers the user. A
  worker in the same API process picks the job up and does the slow part:
  GoDaddy's SMTP server takes two to three seconds to accept each email.

  Why a queue and not Redis pub/sub: a published message is gone if no worker
  happens to be listening at that instant (a deploy restarting the API, say).
  A queued job stays in Redis until a worker has sent it, and a failed send is
  retried with growing delays instead of being dropped.

  When Redis is not configured, or cannot be reached when a job is added, the
  message is sent in the background of this process instead (BackgroundWork).
  The user never waits and a request never fails because of Redis; only the
  retries are lost in that mode.
*/

export const DELIVERY_QUEUE_NAME = 'delivery';

export type EmailJob = { kind: 'email'; email: OutboundEmail };
export type WhatsAppJob = {
  kind: 'whatsapp';
  phone: string;
  template: WhatsAppTemplate;
};
export type DeliveryJob = EmailJob | WhatsAppJob;

/** Email is retried: 15 s, 30 s, 1 min, 2 min, then left in the failed list. */
const EMAIL_JOB: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 15_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2000 },
};

/*
  WhatsApp is tried once. The sender reports Meta's refusals (template not
  approved, number not on WhatsApp) as `false` rather than throwing, and those
  never succeed on a retry.
*/
const WHATSAPP_JOB: JobsOptions = {
  attempts: 1,
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2000 },
};

/** A job must be accepted by Redis within this, or it is sent in-process. */
const ENQUEUE_TIMEOUT_MS = 2_000;

@Injectable()
export class DeliveryQueue implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DeliveryQueue.name);
  private queue: Queue<DeliveryJob> | null = null;
  private worker: Worker<DeliveryJob> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly whatsapp: WhatsAppService,
    private readonly background: BackgroundWork,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.logger.warn(
        'REDIS_URL is not set — emails and WhatsApp messages are sent in-process without a queue or retries.',
      );
      return;
    }

    // Producer: fail fast when Redis is down, so the fallback can take over
    // instead of the request hanging until Redis comes back.
    this.queue = new Queue<DeliveryJob>(DELIVERY_QUEUE_NAME, {
      connection: { url, enableOfflineQueue: false },
    });
    this.queue.on('error', (error) =>
      this.logger.warn(`Delivery queue: ${error.message}`),
    );

    if (this.workerEnabled()) {
      // Worker: BullMQ requires blocking commands to wait indefinitely.
      this.worker = new Worker<DeliveryJob>(
        DELIVERY_QUEUE_NAME,
        (job) => this.process(job.data),
        {
          connection: { url, maxRetriesPerRequest: null },
          // Matches the SMTP pool: three connections to GoDaddy at most.
          concurrency: 3,
        },
      );
      this.worker.on('failed', (job, error) => {
        if (!job) return;
        const attempts = job.opts.attempts ?? 1;
        const final = job.attemptsMade >= attempts;
        this.logger[final ? 'error' : 'warn'](
          `${describe(job.data)} failed (attempt ${job.attemptsMade}/${attempts})${
            final ? ', giving up' : ', will retry'
          }: ${error.message}`,
        );
      });
      this.worker.on('error', (error) =>
        this.logger.warn(`Delivery worker: ${error.message}`),
      );
    }

    try {
      await withTimeout(this.queue.waitUntilReady(), 5_000);
      this.logger.log(
        `Delivery queue ready on Redis${this.worker ? ' (worker running)' : ' (worker disabled)'}.`,
      );
    } catch {
      this.logger.warn(
        'Redis is not reachable yet — messages will be sent in-process until it is.',
      );
    }
  }

  /** Queues an email. Never throws, and returns as soon as Redis accepts it. */
  enqueueEmail(email: OutboundEmail): Promise<'queued' | 'in-process'> {
    return this.enqueue({ kind: 'email', email }, EMAIL_JOB);
  }

  /** Queues a WhatsApp template. Never throws. */
  enqueueWhatsApp(
    phone: string,
    template: WhatsAppTemplate,
  ): Promise<'queued' | 'in-process'> {
    return this.enqueue({ kind: 'whatsapp', phone, template }, WHATSAPP_JOB);
  }

  /**
   * Sends one message. Throws on an email failure so the queue retries it.
   * Public for the worker and the in-process fallback.
   */
  async process(job: DeliveryJob): Promise<void> {
    if (job.kind === 'email') {
      await this.mail.send(job.email);
      return;
    }
    await this.whatsapp.sendTemplate(job.phone, job.template);
  }

  /** Queue depth, for the admin panel and health checks. */
  async stats(): Promise<{
    mode: 'redis' | 'in-process';
    waiting?: number;
    active?: number;
    delayed?: number;
    failed?: number;
  }> {
    if (!this.queue) return { mode: 'in-process' };
    try {
      const counts = await withTimeout(
        this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        ENQUEUE_TIMEOUT_MS,
      );
      return { mode: 'redis', ...counts };
    } catch {
      return { mode: 'in-process' };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    // Lets a job in the middle of sending finish; waiting jobs stay in Redis
    // for the next start.
    await this.worker?.close();
    await this.queue?.close();
  }

  private async enqueue(
    job: DeliveryJob,
    options: JobsOptions,
  ): Promise<'queued' | 'in-process'> {
    if (this.queue) {
      try {
        await withTimeout(
          this.queue.add(job.kind, job, options),
          ENQUEUE_TIMEOUT_MS,
        );
        return 'queued';
      } catch (error: unknown) {
        this.logger.warn(
          `Could not queue ${describe(job)} (${
            error instanceof Error ? error.message : 'unknown error'
          }) — sending in-process instead.`,
        );
      }
    }
    this.background.run(describe(job), () => this.process(job));
    return 'in-process';
  }

  private workerEnabled(): boolean {
    // DELIVERY_WORKER=off lets a second API instance only produce jobs, if the
    // API is ever scaled out and one process should do all the sending.
    return (
      (this.config.get<string>('DELIVERY_WORKER') ?? 'on')
        .trim()
        .toLowerCase() !== 'off'
    );
  }
}

/** A log label that names the message without its contents. */
function describe(job: DeliveryJob): string {
  if (job.kind === 'email') {
    const [user, domain] = job.email.to.split('@');
    return `Email "${job.email.subject}" to ${user?.slice(0, 2) ?? ''}***@${domain ?? ''}`;
  }
  return `WhatsApp ${job.template.name} to ***${job.phone.slice(-2)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
