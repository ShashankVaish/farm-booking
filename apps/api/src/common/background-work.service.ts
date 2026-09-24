import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

/*
  Runs side effects after the response has gone, instead of making the user
  wait for them.

  Emails and WhatsApp messages are the case this exists for: the SMTP server
  takes two to three seconds to accept a message, and a booking used to hold
  the guest on "Reserving…" for all of it. The booking row, the in-app
  notification and everything the response depends on are still written
  before the request returns; only the delivery moves here.

  Work is kept in memory. On shutdown (a deploy restarting the container) the
  app waits up to DRAIN_TIMEOUT_MS for whatever is still in flight, so a
  normal restart does not drop a confirmation email. A hard crash can still
  lose a message that had not been sent yet, the same as before, since
  delivery was already best-effort.
*/

const DRAIN_TIMEOUT_MS = 10_000;

@Injectable()
export class BackgroundWork implements OnApplicationShutdown {
  private readonly logger = new Logger(BackgroundWork.name);
  private readonly pending = new Set<Promise<unknown>>();

  /** Starts `task` without waiting for it. A failure is logged, never thrown. */
  run(label: string, task: () => Promise<unknown>): void {
    const promise = Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        this.logger.error(
          `${label} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      })
      .finally(() => {
        this.pending.delete(promise);
      });
    this.pending.add(promise);
  }

  /** How many tasks are still running. */
  get size(): number {
    return this.pending.size;
  }

  /** Waits for everything in flight, or until the timeout. */
  async drain(timeoutMs = DRAIN_TIMEOUT_MS): Promise<void> {
    if (!this.pending.size) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([Promise.allSettled([...this.pending]), timeout]);
    if (timer) clearTimeout(timer);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.pending.size) {
      this.logger.log(
        `Waiting for ${this.pending.size} background task(s) before shutdown.`,
      );
    }
    await this.drain();
  }
}
