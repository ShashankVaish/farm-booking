import { SupportService } from './support.service';

describe('SupportService', () => {
  it('creates a ticket for the authenticated user only', async () => {
    const prisma = {
      supportTicket: {
        create: jest.fn().mockResolvedValue({ id: 't1', userId: 'u1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };
    const service = new SupportService(prisma as never);
    await service.create('u1', {
      subject: 'Payment issue',
      message: 'Need help with a failed payment.',
    });
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1' }),
      }),
    );
  });
});
