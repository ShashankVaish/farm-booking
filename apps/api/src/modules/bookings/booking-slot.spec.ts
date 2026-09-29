import {
  describeSlot,
  formatClock,
  isSlotOffered,
  readListingSlots,
} from './booking-slot';

describe('booking slots', () => {
  it('reads the slot lines of the host-meta block', () => {
    const slots = readListingSlots(
      [
        '---host-meta-v1---',
        'beds:3',
        'daySlot:true',
        'dayStart:10:30',
        'dayEnd:18:00',
        'nightSlot:true',
        'nightStart:19:00',
        'nightEnd:06:00',
        'overnight:false',
        '---host-meta-v1---',
        'House rules',
      ].join('\n'),
    );
    expect(slots.day).toEqual({ offered: true, start: '10:30', end: '18:00' });
    expect(slots.night).toEqual({
      offered: true,
      start: '19:00',
      end: '06:00',
    });
    expect(slots.overnight.offered).toBe(false);
  });

  it('offers an old listing with no party slots as a night party only', () => {
    const slots = readListingSlots('Just some free-text rules');
    expect(isSlotOffered(slots, 'NIGHT')).toBe(true);
    expect(isSlotOffered(slots, 'DAY')).toBe(false);
    expect(isSlotOffered(slots, 'OVERNIGHT')).toBe(false);
  });

  it('offers only what the host turned on', () => {
    const dayOnly = readListingSlots(
      [
        '---host-meta-v1---',
        'daySlot:true',
        'nightSlot:false',
        '---host-meta-v1---',
      ].join('\n'),
    );
    expect(isSlotOffered(dayOnly, 'DAY')).toBe(true);
    expect(isSlotOffered(dayOnly, 'NIGHT')).toBe(false);
  });

  it('formats 24-hour times for guests', () => {
    expect(formatClock('00:15')).toBe('12:15 am');
    expect(formatClock('10:30')).toBe('10:30 am');
    expect(formatClock('19:00')).toBe('7:00 pm');
  });

  it('ends a night party that runs past midnight on the next date', () => {
    const summary = describeSlot({
      slot: 'NIGHT',
      slotStartTime: '19:00',
      slotEndTime: '06:00',
      checkInDate: new Date('2026-10-07T00:00:00Z'),
      checkOutDate: new Date('2026-10-08T00:00:00Z'),
    });
    expect(summary?.label).toBe('Night party');
    expect(summary?.from).toMatch(/7 Oct.*7:00 pm/);
    expect(summary?.to).toMatch(/8 Oct.*6:00 am/);
  });

  it('ends a day party on the same date and leaves overnight stays alone', () => {
    const day = describeSlot({
      slot: 'DAY',
      slotStartTime: '10:30',
      slotEndTime: '18:00',
      checkInDate: '2026-10-07',
      checkOutDate: '2026-10-08',
    });
    expect(day?.to).toMatch(/7 Oct.*6:00 pm/);
    expect(
      describeSlot({
        slot: 'OVERNIGHT',
        checkInDate: '2026-10-07',
        checkOutDate: '2026-10-08',
      }),
    ).toBeNull();
  });
});
