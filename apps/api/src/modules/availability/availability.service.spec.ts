import { AvailabilityStatus } from '@prisma/client';
import { AvailabilityService } from './availability.service';

describe('availability validation', () => {
  it('treats BOOKED nights and BLOCKED overrides as unavailable', async () => {
    const prisma = {
      availability: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ date: new Date('2026-10-01') }]),
      },
      bookingNight: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const properties = { requireManaged: jest.fn() };
    const service = new AvailabilityService(
      prisma as never,
      properties as never,
    );

    await expect(
      service.assertRangeAvailable(
        'p1',
        '2026-10-01',
        '2026-10-03',
        prisma as never,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'DATES_UNAVAILABLE',
      }),
    });

    prisma.availability.findMany.mockResolvedValue([]);
    prisma.bookingNight.findMany.mockResolvedValue([
      { date: new Date('2026-10-02') },
    ]);

    await expect(
      service.assertRangeAvailable('p1', '2026-10-01', '2026-10-03'),
    ).rejects.toBeDefined();

    expect(AvailabilityStatus.BLOCKED).toBe('BLOCKED');
  });
});
