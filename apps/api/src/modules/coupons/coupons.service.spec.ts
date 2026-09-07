import { CouponsService } from './coupons.service';

describe('CouponsService redemption limits', () => {
  it('rejects a global increment when no row is updated', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(0),
    };
    const service = new CouponsService(prisma as never);
    await expect(
      service.incrementRedemption(prisma as never, 'c1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'COUPON_LIMIT_REACHED' }),
    });
  });

  it('rejects a per-user overage inside a transaction', async () => {
    const tx = {
      booking: { count: jest.fn().mockResolvedValue(3) },
    };
    const service = new CouponsService({} as never);
    await expect(
      service.assertPerUserLimit(tx as never, 'c1', 'u1', 2),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'COUPON_LIMIT_REACHED' }),
    });
  });
});
