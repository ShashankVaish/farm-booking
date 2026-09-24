import { PaymentStatus, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import {
  assertPaymentTransition,
  isCapturablePaymentStatus,
} from './payment-status';

const customer = {
  id: 'c1',
  email: 'c@x.com',
  role: 'CUSTOMER',
  name: 'C',
} as const;

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

describe('payment status machine', () => {
  it('allows capture from in-flight and late-capture states', () => {
    expect(isCapturablePaymentStatus(PaymentStatus.PENDING)).toBe(true);
    expect(isCapturablePaymentStatus(PaymentStatus.PROCESSING)).toBe(true);
    expect(isCapturablePaymentStatus(PaymentStatus.FAILED)).toBe(true);
    expect(isCapturablePaymentStatus(PaymentStatus.EXPIRED)).toBe(true);
    expect(isCapturablePaymentStatus(PaymentStatus.SUCCESS)).toBe(false);
    expect(() =>
      assertPaymentTransition(PaymentStatus.SUCCESS, PaymentStatus.FAILED),
    ).toThrow();
  });
});

describe('PaymentsService money-safety', () => {
  const provider = {
    name: 'PHONEPE',
    isConfigured: jest.fn().mockReturnValue(true),
    createIntent: jest.fn(),
    checkoutForm: jest.fn().mockReturnValue({
      action: 'https://mercury.phonepe.com/transact/pg?token=abc',
      method: 'GET',
      fields: {},
    }),
    parseNotification: jest.fn(),
    parseReturn: jest.fn(),
    verifyPayment: jest.fn(),
    createRefund: jest.fn(),
    fetchRefund: jest.fn(),
    fetchOrder: jest.fn(),
    fetchPayment: jest.fn(),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const availability = {
    markBooked: jest.fn(),
    assertRangeAvailable: jest.fn(),
    releaseBooked: jest.fn(),
  };
  const pricing = { platformFeeBps: jest.fn().mockReturnValue(500) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(30) };
  // Booking hold now comes from PlatformSettingsService rather than env.
  const platformSettings = { getNumber: jest.fn().mockReturnValue(30) };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_1',
      providerOrderId: 'order_1',
      amountPaise: 105000,
      currency: 'INR',
      captured: true,
      status: 'SUCCESS',
      bookingId: 'b1',
    });
    provider.createRefund.mockResolvedValue({
      providerRefundId: 'rfd_auto',
      providerStatus: 'processed',
    });
  });

  function pendingPayment(overrides?: Record<string, unknown>) {
    return {
      id: 'pay-row',
      bookingId: 'b1',
      providerOrderId: 'order_1',
      providerPaymentId: null,
      amount: decimal('1050.00'),
      currency: 'INR',
      status: PaymentStatus.PENDING,
      booking: {
        id: 'b1',
        customerId: 'c1',
        propertyId: 'p1',
        status: 'PAYMENT_PENDING',
        checkInDate: new Date('2026-10-01'),
        checkOutDate: new Date('2026-10-02'),
        guestCount: 4,
        totalAmount: decimal('1050.00'),
        platformFee: decimal('50.00'),
        nights: [{ date: new Date('2026-10-01') }],
        // Mirrors paymentBookingInclude. settleCapturedPayment reloads the row
        // itself with that include, so anything it selects has to be here or
        // the fixture is testing a shape production never sees.
        customer: { id: 'c1', name: 'Asha Rao', email: 'asha@example.com' },
        property: {
          title: 'Lake House',
          ownerId: 'o1',
          city: 'Lonavala',
          state: 'Maharashtra',
        },
      },
      ...overrides,
    };
  }

  const mail = {
    brandName: () => 'Baagly',
    webUrl: () => 'https://baagly.test',
    sendQuietly: jest.fn().mockResolvedValue(true),
  };

  function service(prisma: object) {
    return new PaymentsService(
      prisma as never,
      provider,
      notifications as never,
      availability as never,
      pricing as never,
      config as never,
      audit as never,
      platformSettings as never,
      mail as never,
    );
  }

  function settlePrisma(
    payment: ReturnType<typeof pendingPayment>,
    options?: {
      lockCount?: number;
      nights?: unknown[];
      bookingStatus?: string;
    },
  ) {
    const nights = options?.nights ?? [{ date: new Date('2026-10-01') }];
    const tx = {
      payment: {
        updateMany: jest
          .fn()
          .mockResolvedValue({ count: options?.lockCount ?? 1 }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          ...payment,
          status: PaymentStatus.SUCCESS,
        }),
      },
      bookingNight: {
        findMany: jest.fn().mockResolvedValue(nights),
        deleteMany: jest.fn(),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          status: options?.bookingStatus ?? 'PAYMENT_PENDING',
        }),
        update: jest.fn(),
      },
      commission: { upsert: jest.fn() },
    };
    return {
      payment: {
        findFirst: jest.fn().mockResolvedValue(payment),
        findUnique: jest.fn().mockResolvedValue(payment),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue(payment.booking),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      refund: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rf1', status: 'REQUESTED' }),
        update: jest.fn(),
      },
      processedWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(
        async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      ),
      tx,
    };
  }

  it('1. confirms only after gateway capture and matching amount', async () => {
    const prisma = settlePrisma(pendingPayment());
    const result = await service(prisma).settleCapturedPayment(
      'order_1',
      'pay_1',
    );
    // PhonePe finds an attempt through its order, so both ids must be passed.
    expect(provider.fetchPayment).toHaveBeenCalledWith('pay_1', 'order_1');
    expect(result).toMatchObject({ confirm: true, idempotent: false });
    expect(availability.markBooked).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_VERIFIED' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BOOKING_CONFIRMED' }),
    );
  });

  it('2. keeps the booking retryable when payment fails', async () => {
    const payment = pendingPayment();
    const prisma = settlePrisma(payment);
    prisma.payment.findFirst.mockResolvedValue(payment);
    provider.parseNotification.mockReturnValue({
      verified: true,
      providerOrderId: 'order_1',
      providerPaymentId: 'pay_1',
      status: 'FAILED',
      amountPaise: 105000,
      reason: 'Card declined',
    });
    const result = await service(prisma).handleWebhook(
      '{"event":"checkout.order.failed","payload":{}}',
      { authorization: 'hash', 'x-event-id': 'evt-fail' },
    );
    expect(result).toMatchObject({ failed: true });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.FAILED }),
      }),
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('3-4. reconcile recovers capture after the browser or network drops', async () => {
    const prisma = settlePrisma(pendingPayment());
    provider.fetchOrder.mockResolvedValue({
      providerOrderId: 'order_1',
      status: 'SUCCESS',
      providerPaymentId: 'pay_1',
    });
    await service(prisma).reconcile('pay-row');
    expect(availability.markBooked).toHaveBeenCalled();
  });

  it('5-8. checkout verify and webhook are idempotent in either order', async () => {
    const success = pendingPayment({ status: PaymentStatus.SUCCESS });
    const prisma = settlePrisma(success);
    prisma.payment.findFirst.mockResolvedValue(success);
    const payments = service(prisma);
    provider.parseNotification.mockReturnValue({
      verified: true,
      providerOrderId: 'order_1',
      providerPaymentId: 'pay_1',
      status: 'SUCCESS',
      amountPaise: 105000,
    });
    const webhookBody = '{"event":"checkout.order.completed","payload":{}}';
    const headers = { authorization: 'hash', 'x-event-id': 'evt-1' };
    const first = await payments.handleWebhook(webhookBody, headers);
    prisma.processedWebhookEvent.findUnique.mockResolvedValue({
      id: 'evt-1',
      event: 'phonepe.success',
    });
    const second = await payments.handleWebhook(webhookBody, headers);
    expect(first).toMatchObject({ idempotent: true });
    expect(second).toMatchObject({ idempotent: true });
    expect(availability.markBooked).not.toHaveBeenCalled();

    provider.verifyPayment.mockResolvedValue({
      verified: true,
      status: 'SUCCESS',
      providerPaymentId: 'pay_1',
    });
    const verify = await payments.verifyCheckout(customer, {
      providerOrderId: 'order_1',
      providerPaymentId: 'pay_1',
      signature: 'ok',
    });
    expect(verify).toMatchObject({ idempotent: true });
  });

  it('acknowledges and ignores a webhook for an order this site did not create', async () => {
    const prisma = settlePrisma(pendingPayment());
    prisma.payment.findFirst.mockResolvedValue(null);
    provider.parseNotification.mockReturnValue({
      verified: true,
      kind: 'payment',
      providerOrderId: 'payment-link-order',
      providerPaymentId: 'txn_9',
      status: 'SUCCESS',
      amountPaise: 5000,
    });
    const result = await service(prisma).handleWebhook('{}', {
      authorization: 'hash',
    });
    expect(result).toMatchObject({ ignored: true, reason: 'unknown-order' });
    expect(provider.fetchPayment).not.toHaveBeenCalled();
    expect(availability.markBooked).not.toHaveBeenCalled();
  });

  it('refuses a webhook whose Authorization does not verify', async () => {
    const prisma = settlePrisma(pendingPayment());
    provider.parseNotification.mockReturnValue({
      verified: false,
      kind: 'payment',
      providerOrderId: 'order_1',
      providerPaymentId: 'pay_1',
      status: 'SUCCESS',
      amountPaise: 105000,
    });
    await expect(
      service(prisma).handleWebhook('{}', { authorization: 'forged' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PAYMENT_NOT_VERIFIED' }),
    });
    expect(availability.markBooked).not.toHaveBeenCalled();
  });

  it('completes a refund from the refund webhook', async () => {
    const success = pendingPayment({
      status: PaymentStatus.REFUND_PENDING,
      providerPaymentId: 'pay_1',
    });
    const prisma = settlePrisma(success);
    const refundRow = {
      id: 'rf1',
      paymentId: 'pay-row',
      bookingId: 'b1',
      status: 'PROCESSING',
      providerRefundId: 'RFrf1',
    };
    prisma.refund.findFirst.mockResolvedValue(refundRow);
    (prisma.tx as unknown as Record<string, unknown>).refund = {
      update: jest
        .fn()
        .mockResolvedValue({ ...refundRow, status: 'COMPLETED' }),
    };
    prisma.payment.findUnique.mockResolvedValue({
      ...success,
      refunds: [{ status: 'COMPLETED', amount: decimal('1050.00') }],
      booking: { status: 'CANCELLED', customerId: 'c1' },
    });
    provider.parseNotification.mockReturnValue({
      verified: true,
      kind: 'refund',
      providerOrderId: 'order_1',
      providerPaymentId: null,
      status: 'PENDING',
      amountPaise: 105000,
      refund: { providerRefundId: 'RFrf1', providerStatus: 'completed' },
    });
    await service(prisma).handleWebhook('{}', { authorization: 'hash' });
    expect(prisma.refund.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerRefundId: 'RFrf1' } }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PaymentStatus.REFUNDED },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_COMPLETED' }),
    );
  });

  it('9. rejects an incorrect captured amount', async () => {
    provider.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_1',
      providerOrderId: 'order_1',
      amountPaise: 100,
      currency: 'INR',
      captured: true,
      status: 'SUCCESS',
      bookingId: 'b1',
    });
    const prisma = settlePrisma(pendingPayment());
    await expect(
      service(prisma).settleCapturedPayment('order_1', 'pay_1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'PAYMENT_AMOUNT_MISMATCH',
      }),
    });
    expect(availability.markBooked).not.toHaveBeenCalled();
    expect(provider.createRefund).toHaveBeenCalled();
  });

  it('10. rejects a capture that belongs to a different booking', async () => {
    provider.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_1',
      providerOrderId: 'order_1',
      amountPaise: 105000,
      currency: 'INR',
      captured: true,
      status: 'SUCCESS',
      bookingId: 'other-booking',
    });
    const prisma = settlePrisma(pendingPayment());
    await expect(
      service(prisma).settleCapturedPayment('order_1', 'pay_1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PAYMENT_NOT_VERIFIED' }),
    });
  });

  it('11. expires unpaid bookings as EXPIRED after checking the gateway', async () => {
    const stale = {
      id: 'b1',
      propertyId: 'p1',
      status: 'PAYMENT_PENDING',
      nights: [{ date: new Date('2026-10-01') }],
      payments: [{ providerOrderId: 'order_1', status: PaymentStatus.PENDING }],
    };
    const prisma = settlePrisma(pendingPayment());
    prisma.booking.findMany.mockResolvedValue([stale]);
    provider.fetchOrder.mockResolvedValue({
      providerOrderId: 'order_1',
      status: 'CREATED',
    });
    const result = await service(prisma).expireAbandoned();
    expect(result.expired).toBe(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_EXPIRED' }),
    );
  });

  it('12-13. reuses an open gateway order instead of creating a duplicate', async () => {
    const existing = pendingPayment();
    const prisma = settlePrisma(existing);
    prisma.booking.findUnique.mockResolvedValue({
      ...existing.booking,
      customer: { email: 'c@x.com' },
      payments: [existing],
      customerId: 'c1',
      checkInDate: new Date('2026-10-01'),
      checkOutDate: new Date('2026-10-02'),
      status: 'PAYMENT_PENDING',
    });
    const first = await service(prisma).createOrder(customer, {
      bookingId: 'b1',
    });
    const second = await service(prisma).createOrder(customer, {
      bookingId: 'b1',
    });
    expect(first.providerOrderId).toBe('order_1');
    expect(second.providerOrderId).toBe('order_1');
    expect(provider.createIntent).not.toHaveBeenCalled();
  });

  it('14. does not confirm when nights were taken by another booking', async () => {
    const prisma = settlePrisma(pendingPayment(), { nights: [] });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      payments: [
        pendingPayment({
          status: PaymentStatus.SUCCESS,
          providerPaymentId: 'pay_1',
          refunds: [],
        }),
      ],
    });
    prisma.refund.create.mockResolvedValue({ id: 'rf1' });
    provider.createRefund.mockResolvedValue({
      providerRefundId: 'rfd_1',
      providerStatus: 'processed',
    });
    const result = await service(prisma).settleCapturedPayment(
      'order_1',
      'pay_1',
    );
    // settleCapturedPayment returns a union; this path is the settled branch,
    // which is the only one carrying these flags.
    expect(result).toMatchObject({ confirm: false, refundInventory: true });
    expect(availability.markBooked).not.toHaveBeenCalled();
  });

  it('15-16. refunds a captured payment after cancellation', async () => {
    const success = pendingPayment({
      status: PaymentStatus.SUCCESS,
      providerPaymentId: 'pay_1',
      refunds: [],
    });
    const prisma = settlePrisma(success);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      payments: [success],
    });
    provider.createRefund.mockResolvedValue({
      providerRefundId: 'rfd_1',
      providerStatus: 'processed',
    });
    prisma.refund.update.mockResolvedValue({
      id: 'rf1',
      status: 'COMPLETED',
    });
    prisma.payment.findUnique.mockResolvedValue({
      ...success,
      refunds: [{ status: 'COMPLETED', amount: decimal('1050.00') }],
      booking: { status: 'CANCELLED' },
    });
    const result = await service(prisma).requestRefundForBooking(
      'b1',
      'customer cancel',
    );
    expect(result).toMatchObject({
      refund: expect.objectContaining({ id: 'rf1' }),
    });
    // Refunds are addressed by the original order, and each refund row gets
    // its own gateway refund id.
    expect(provider.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOrderId: 'order_1',
        reference: 'rf1',
        amountPaise: 105000,
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_REQUESTED' }),
    );
  });

  it('17. records REFUND_FAILED when the gateway rejects the refund', async () => {
    const success = pendingPayment({
      status: PaymentStatus.SUCCESS,
      providerPaymentId: 'pay_1',
      refunds: [],
    });
    const prisma = settlePrisma(success);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      payments: [success],
    });
    provider.createRefund.mockResolvedValue({
      providerRefundId: null,
      providerStatus: 'failed',
    });
    prisma.refund.update.mockResolvedValue({ id: 'rf1', status: 'FAILED' });
    const result = await service(prisma).requestRefundForBooking('b1', 'fail');
    expect(result).toMatchObject({
      refund: expect.objectContaining({ status: 'FAILED' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_FAILED' }),
    );
  });

  it('18. allows a partial refund while money remains captured', async () => {
    const success = pendingPayment({
      status: PaymentStatus.SUCCESS,
      providerPaymentId: 'pay_1',
      refunds: [],
    });
    const prisma = settlePrisma(success);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      payments: [success],
    });
    provider.createRefund.mockResolvedValue({
      providerRefundId: 'rfd_partial',
      providerStatus: 'processed',
    });
    prisma.refund.update.mockResolvedValue({ id: 'rf1', status: 'COMPLETED' });
    prisma.payment.findUnique.mockResolvedValue({
      ...success,
      refunds: [{ status: 'COMPLETED', amount: decimal('100.00') }],
      booking: { status: 'CONFIRMED' },
    });
    await service(prisma).requestRefundForBooking('b1', 'partial', 100);
    expect(provider.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 10000 }),
    );
  });

  it('19. does not confirm when the gateway cannot be reached', async () => {
    provider.fetchPayment.mockResolvedValue(null);
    const prisma = settlePrisma(pendingPayment());
    await expect(
      service(prisma).settleCapturedPayment('order_1', 'pay_1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'PAYMENT_PROVIDER_ERROR',
      }),
    });
    expect(availability.markBooked).not.toHaveBeenCalled();
  });

  it('20. treats PROCESSING as capturable after a restart', async () => {
    const prisma = settlePrisma(
      pendingPayment({ status: PaymentStatus.PROCESSING }),
    );
    await service(prisma).settleCapturedPayment('order_1', 'pay_1');
    expect(availability.markBooked).toHaveBeenCalled();
  });

  it('does not confirm a booking when checkout signature is invalid', async () => {
    provider.verifyPayment.mockResolvedValue({
      verified: false,
      status: 'FAILED',
      providerPaymentId: 'pay_1',
    });
    const prisma = settlePrisma(pendingPayment());
    await expect(
      service(prisma).verifyCheckout(customer as never, {
        providerOrderId: 'order_1',
        providerPaymentId: 'pay_1',
        signature: 'bad',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PAYMENT_NOT_VERIFIED' }),
    });
  });

  it('forbids verifying another customer payment', async () => {
    const prisma = settlePrisma(
      pendingPayment({ booking: { customerId: 'other-user' } }),
    );
    await expect(
      service(prisma).verifyCheckout(customer as never, {
        providerOrderId: 'order_1',
        providerPaymentId: 'pay_1',
        signature: 'sig',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'FORBIDDEN' }),
    });
  });
});

describe('PaymentsService gateway return', () => {
  /*
    The browser arrives here straight from PhonePe's page with nothing but the
    order id we put in the URL. The outcome is always asked of the gateway,
    and whatever happens the answer is a redirect into the site — a guest who
    has just paid must never be shown an API error.
  */
  const provider = {
    name: 'PHONEPE',
    isConfigured: jest.fn().mockReturnValue(true),
    createIntent: jest.fn(),
    checkoutForm: jest.fn(),
    parseNotification: jest.fn(),
    parseReturn: jest.fn(),
    verifyPayment: jest.fn(),
    createRefund: jest.fn(),
    fetchRefund: jest.fn(),
    fetchOrder: jest.fn(),
    fetchPayment: jest.fn(),
  };
  const mail = {
    brandName: () => 'Baagly',
    webUrl: () => 'https://baagly.test',
    sendQuietly: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.parseReturn.mockReturnValue('BKb1_abc');
  });

  function build(options: {
    bookingStatus?: string;
    paymentStatus?: string;
    known?: boolean;
    reconcile?: () => Promise<unknown>;
  }) {
    const prisma = {
      payment: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options.known === false ? null : { id: 'pay-row', bookingId: 'b1' },
          ),
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: options.paymentStatus ?? 'PENDING' }),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          status: options.bookingStatus ?? 'PAYMENT_PENDING',
        }),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      provider,
      { notify: jest.fn() } as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      { record: jest.fn() } as never,
      { getNumber: jest.fn().mockReturnValue(30) } as never,
      mail as never,
    );
    const reconcile = jest
      .spyOn(service, 'reconcile')
      .mockImplementation(
        (options.reconcile ?? (() => Promise.resolve({}))) as never,
      );
    return { service, prisma, reconcile };
  }

  it('asks the gateway and sends a paid guest to the confirmation page', async () => {
    const { service, prisma, reconcile } = build({
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
    });
    await expect(service.handleReturn('order=BKb1_abc')).resolves.toEqual({
      redirectTo: 'https://baagly.test/booking/b1/confirmation',
    });
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerOrderId: 'BKb1_abc' } }),
    );
    expect(reconcile).toHaveBeenCalledWith('pay-row');
  });

  it('sends a guest whose order failed back to the booking with the outcome', async () => {
    const { service } = build({ paymentStatus: 'FAILED' });
    await expect(service.handleReturn('order=BKb1_abc')).resolves.toEqual({
      redirectTo: 'https://baagly.test/booking/b1?payment=failed',
    });
  });

  it('reports an order that is still open as pending, for the page to poll', async () => {
    // The guest backed out of PhonePe's page, or UPI is still processing.
    const { service } = build({ paymentStatus: 'PENDING' });
    await expect(service.handleReturn('order=BKb1_abc')).resolves.toEqual({
      redirectTo: 'https://baagly.test/booking/b1?payment=pending',
    });
  });

  it('never reads an outcome from the return itself', async () => {
    const { service } = build({ paymentStatus: 'PENDING' });
    await service.handleReturn('order=BKb1_abc&state=COMPLETED');
    expect(provider.parseNotification).not.toHaveBeenCalled();
  });

  it('redirects to a safe place when the return carries no order id', async () => {
    provider.parseReturn.mockReturnValue(null);
    const { service, reconcile } = build({});
    await expect(service.handleReturn('garbage')).resolves.toEqual({
      redirectTo: 'https://baagly.test/dashboard/trips?payment=unknown',
    });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('redirects to a safe place for an order id that is not ours', async () => {
    const { service, reconcile } = build({ known: false });
    await expect(service.handleReturn('order=BKzz_1')).resolves.toEqual({
      redirectTo: 'https://baagly.test/dashboard/trips?payment=unknown',
    });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('turns a gateway failure into a "pending" redirect, not an error page', async () => {
    // e.g. the status API timed out while we checked the order.
    const { service } = build({
      reconcile: () => Promise.reject(new Error('gateway timeout')),
    });
    await expect(service.handleReturn('order=BKb1_abc')).resolves.toEqual({
      redirectTo: 'https://baagly.test/booking/b1?payment=pending',
    });
  });
});
