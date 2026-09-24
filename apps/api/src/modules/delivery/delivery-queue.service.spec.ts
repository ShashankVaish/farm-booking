import { BackgroundWork } from '../../common/background-work.service';
import { DeliveryQueue } from './delivery-queue.service';

const email = {
  to: 'asha@example.com',
  subject: 'Booking confirmed',
  html: '<p>hi</p>',
  text: 'hi',
};
const template = { name: 'booking_confirmed', bodyParams: ['Asha'] };

function build(env: Record<string, string> = {}) {
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = { sendTemplate: jest.fn().mockResolvedValue(true) };
  const background = new BackgroundWork();
  const service = new DeliveryQueue(
    { get: (key: string) => env[key] } as never,
    mail as never,
    whatsapp as never,
    background,
  );
  return { service, mail, whatsapp, background };
}

/** Puts a fake BullMQ queue in place of a real Redis connection. */
function withQueue(service: DeliveryQueue, add: jest.Mock) {
  (service as unknown as { queue: unknown }).queue = { add };
}

describe('DeliveryQueue', () => {
  it('queues an email in Redis with retries, and sends nothing itself', async () => {
    const { service, mail } = build();
    const add = jest.fn().mockResolvedValue({ id: '1' });
    withQueue(service, add);

    await expect(service.enqueueEmail(email)).resolves.toBe('queued');

    expect(add).toHaveBeenCalledWith(
      'email',
      { kind: 'email', email },
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 15_000 },
      }),
    );
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('queues WhatsApp without retries', async () => {
    const { service } = build();
    const add = jest.fn().mockResolvedValue({ id: '2' });
    withQueue(service, add);

    await service.enqueueWhatsApp('9876543210', template);

    expect(add).toHaveBeenCalledWith(
      'whatsapp',
      { kind: 'whatsapp', phone: '9876543210', template },
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it('sends in-process when Redis refuses the job', async () => {
    const { service, mail, background } = build();
    withQueue(
      service,
      jest.fn().mockRejectedValue(new Error('Connection is closed.')),
    );

    await expect(service.enqueueEmail(email)).resolves.toBe('in-process');
    await background.drain();

    expect(mail.send).toHaveBeenCalledWith(email);
  });

  it('does not hold the request when Redis hangs', async () => {
    jest.useFakeTimers();
    try {
      const { service } = build();
      withQueue(
        service,
        jest.fn(() => new Promise(() => undefined)),
      );
      const result = service.enqueueEmail(email);
      await jest.advanceTimersByTimeAsync(2_100);
      await expect(result).resolves.toBe('in-process');
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends in-process when no REDIS_URL is configured', async () => {
    const { service, mail, whatsapp, background } = build();
    await service.onModuleInit();

    await expect(service.enqueueEmail(email)).resolves.toBe('in-process');
    await service.enqueueWhatsApp('9876543210', template);
    await background.drain();

    expect(mail.send).toHaveBeenCalledWith(email);
    expect(whatsapp.sendTemplate).toHaveBeenCalledWith('9876543210', template);
    await expect(service.stats()).resolves.toEqual({ mode: 'in-process' });
  });

  it('lets an email failure throw, so the queue retries it', async () => {
    const { service, mail } = build();
    mail.send.mockRejectedValue(new Error('SMTP 421 try again later'));
    await expect(service.process({ kind: 'email', email })).rejects.toThrow(
      'SMTP 421',
    );
  });
});
