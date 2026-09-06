import { PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService verification and webhook idempotency', () => {
  const provider = {
    name: 'RAZORPAY',
    createIntent: jest.fn(),
    verifyPayment: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    createRefund: jest.fn(),
  };

  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const availability = { markBooked: jest.fn() };
  const pricing = { platformFeeBps: jest.fn().mockReturnValue(500) };

  it('does not confirm a booking when checkout signature is invalid', async () => {
    provider.verifyPayment.mockResolvedValue({
      verified: false,
      status: 'FAILED',
      providerPaymentId: 'pay_1',
    });
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-row',
          status: PaymentStatus.PENDING,
          booking: {
            customerId: 'c1',
            status: 'PAYMENT_PENDING',
            nights: [],
            property: { title: 'X', ownerId: 'o1' },
          },
        }),
        update: jest.fn(),
      },
      booking: { update: jest.fn() },
      bookingNight: { deleteMany: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          payment: { update: jest.fn() },
          booking: { update: jest.fn() },
          bookingNight: { deleteMany: jest.fn() },
        }),
      ),
    };

    const config = { get: jest.fn().mockReturnValue(30) };
    const service = new PaymentsService(
      prisma as never,
      provider,
      notifications as never,
      availability as never,
      pricing as never,
      config as never,
    );

    await expect(
      service.verifyCheckout(
        {
          id: 'c1',
          email: 'c@x.com',
          role: 'CUSTOMER',
          name: 'C',
        } as never,
        {
          providerOrderId: 'order_1',
          providerPaymentId: 'pay_1',
          signature: 'bad',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PAYMENT_NOT_VERIFIED' }),
    });
  });

  it('is idempotent when a captured webhook is delivered twice', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-row',
          status: PaymentStatus.SUCCESS,
          bookingId: 'b1',
          booking: {
            customerId: 'c1',
            propertyId: 'p1',
            status: 'CONFIRMED',
            nights: [],
            property: { title: 'X', ownerId: 'o1' },
          },
        }),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      provider,
      notifications as never,
      availability as never,
      pricing as never,
      { get: jest.fn() } as never,
    );

    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: 'pay_1', order_id: 'order_1', status: 'captured' },
        },
      },
    });

    const first = await service.handleWebhook(body, 'sig');
    const second = await service.handleWebhook(body, 'sig');
    expect(first).toMatchObject({ idempotent: true });
    expect(second).toMatchObject({ idempotent: true });
    expect(availability.markBooked).not.toHaveBeenCalled();
  });

  it('forbids verifying another customer payment', async () => {
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-row',
          status: PaymentStatus.PENDING,
          booking: { customerId: 'other-user' },
        }),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      provider,
      notifications as never,
      availability as never,
      pricing as never,
      { get: jest.fn() } as never,
    );
    await expect(
      service.verifyCheckout(
        {
          id: 'c1',
          email: 'c@x.com',
          role: 'CUSTOMER',
          name: 'C',
        } as never,
        {
          providerOrderId: 'order_1',
          providerPaymentId: 'pay_1',
          signature: 'sig',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'FORBIDDEN' }),
    });
  });
});
