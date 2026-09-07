import { AuditActions, AuditService } from './audit.service';

describe('AuditService', () => {
  it('strips payment secrets from stored metadata', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new AuditService({
      auditLog: { create },
    } as never);
    await service.record({
      action: AuditActions.PAYMENT_VERIFIED,
      entityType: 'Payment',
      entityId: 'p1',
      metadata: {
        bookingId: 'b1',
        signature: 'should-not-store',
        cvv: '123',
        amount: '1050.00',
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { bookingId: 'b1', amount: '1050.00' },
      }),
    });
  });
});
