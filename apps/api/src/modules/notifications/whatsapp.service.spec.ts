import {
  WhatsAppService,
  templateText,
  whatsappNumber,
} from './whatsapp.service';
import {
  WHATSAPP_TEMPLATES,
  bookingCancelledWhatsApp,
  bookingConfirmedWhatsApp,
  hostBookingConfirmedWhatsApp,
  paymentFailedWhatsApp,
  refundProcessedWhatsApp,
} from './whatsapp-templates';

const ENV: Record<string, string> = {
  WHATSAPP_ACCESS_TOKEN: 'EAAtoken',
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
};

function service(env: Record<string, string> = ENV) {
  return new WhatsAppService({ get: (key: string) => env[key] } as never);
}

afterEach(() => jest.restoreAllMocks());

describe('WhatsAppService', () => {
  it('sends an approved template through the Cloud API', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{"messages":[{"id":"wamid.1"}]}'));

    const sent = await service().sendTemplate('9876543210', {
      name: 'booking_confirmed',
      bodyParams: ['Asha', 'Lake\nHouse'],
      urlButtonParam: 'b1',
    });

    expect(sent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://graph.facebook.com/v21.0/123456789012345/messages',
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer EAAtoken',
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919876543210',
      type: 'template',
      template: {
        name: 'booking_confirmed',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Asha' },
              { type: 'text', text: 'Lake House' },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: 'b1' }],
          },
        ],
      },
    });
  });

  it('reports a refusal from Meta without throwing', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          '{"error":{"code":132001,"message":"Template name does not exist in the translation"}}',
          { status: 404 },
        ),
      );
    await expect(
      service().sendTemplate('9876543210', { name: 'x', bodyParams: [] }),
    ).resolves.toBe(false);
  });

  it('reports a network failure without throwing', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      service().sendTemplate('9876543210', { name: 'x', bodyParams: [] }),
    ).resolves.toBe(false);
  });

  it('sends nothing when it is not configured or the number is not Indian', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    expect(service({}).isConfigured()).toBe(false);
    await expect(
      service({}).sendTemplate('9876543210', { name: 'x', bodyParams: [] }),
    ).resolves.toBe(false);
    await expect(
      service().sendTemplate('12345', { name: 'x', bodyParams: [] }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('formats numbers and parameters the way Meta accepts them', () => {
    expect(whatsappNumber('9876543210')).toBe('919876543210');
    expect(whatsappNumber('+91 98765 43210')).toBe('919876543210');
    expect(whatsappNumber('0123456789')).toBeNull();
    expect(templateText('  Lake\tHouse\n  Farm     ')).toBe('Lake House Farm');
    expect(templateText('')).toBe('-');
  });
});

describe('WhatsApp templates', () => {
  const stay = {
    propertyTitle: 'Lake House',
    checkIn: new Date('2026-10-03T00:00:00Z'),
    checkOut: new Date('2026-10-04T00:00:00Z'),
    guests: 6,
    bookingId: '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b',
  };

  const built = [
    [
      WHATSAPP_TEMPLATES.bookingConfirmed,
      bookingConfirmedWhatsApp({ ...stay, guestName: 'Asha Rao' }),
    ],
    [
      WHATSAPP_TEMPLATES.hostBookingConfirmed,
      hostBookingConfirmedWhatsApp({
        ...stay,
        hostName: 'Ravi',
        guestName: 'Asha Rao',
      }),
    ],
    [
      WHATSAPP_TEMPLATES.paymentFailed,
      paymentFailedWhatsApp({
        guestName: 'Asha',
        propertyTitle: 'Lake House',
        bookingId: 'b1',
      }),
    ],
    [
      WHATSAPP_TEMPLATES.bookingCancelled,
      bookingCancelledWhatsApp({ ...stay, guestName: 'Asha' }),
    ],
    [
      WHATSAPP_TEMPLATES.refundProcessed,
      refundProcessedWhatsApp({
        guestName: 'Asha',
        amount: '12500.00',
        propertyTitle: 'Lake House',
      }),
    ],
  ] as const;

  it.each(built)(
    '%s fills exactly the placeholders its approved text has',
    (definition, message) => {
      const placeholders = definition.body.match(/\{\{\d+\}\}/g) ?? [];
      expect(message.name).toBe(definition.name);
      expect(message.bodyParams).toHaveLength(placeholders.length);
      expect(definition.examples).toHaveLength(placeholders.length);
      // A dynamic button needs a value; a static one must not get one.
      const dynamicButton =
        'button' in definition && definition.button.url.includes('{{1}}');
      expect(Boolean(message.urlButtonParam)).toBe(dynamicButton);
    },
  );

  it('greets by first name and quotes readable dates and amounts', () => {
    expect(
      bookingConfirmedWhatsApp({ ...stay, guestName: 'Asha Rao' }).bodyParams,
    ).toEqual([
      'Asha',
      'Lake House',
      'Sat, 3 Oct, 2026',
      'Sun, 4 Oct, 2026',
      '6',
      '3E4F5A6B',
    ]);
    expect(
      refundProcessedWhatsApp({
        guestName: 'Asha',
        amount: '12500.00',
        propertyTitle: 'X',
      }).bodyParams[1],
    ).toBe('₹12,500');
  });
});
