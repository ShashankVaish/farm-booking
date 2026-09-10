import { describe, expect, it } from 'vitest';
import {
  durationMinutes,
  formatDuration,
  formatSlotRange,
  formatTime12,
  fromMinutes,
  isValidTime,
  snapToStep,
  timeOptions,
  toMinutes,
} from './clock';

describe('isValidTime', () => {
  it('accepts 24-hour times', () => {
    for (const value of ['00:00', '9:30', '09:30', '13:45', '23:59']) {
      expect(isValidTime(value)).toBe(true);
    }
  });

  it('rejects anything that is not a time', () => {
    for (const value of ['24:00', '12:60', '2pm', '', '1230', '-1:00']) {
      expect(isValidTime(value)).toBe(false);
    }
  });
});

describe('toMinutes / fromMinutes', () => {
  it('round-trips', () => {
    expect(toMinutes('14:30')).toBe(870);
    expect(fromMinutes(870)).toBe('14:30');
  });

  it('pads single-digit hours so values sort as strings', () => {
    expect(fromMinutes(9 * 60)).toBe('09:00');
  });

  it('wraps past midnight rather than producing a negative time', () => {
    expect(fromMinutes(1440)).toBe('00:00');
    expect(fromMinutes(1500)).toBe('01:00');
    expect(fromMinutes(-60)).toBe('23:00');
  });

  it('returns null for junk instead of NaN', () => {
    expect(toMinutes('nonsense')).toBeNull();
  });
});

describe('formatTime12', () => {
  it('shows midnight and noon as 12, not 0', () => {
    expect(formatTime12('00:00')).toBe('12:00 am');
    expect(formatTime12('12:00')).toBe('12:00 pm');
  });

  it('converts afternoon times a host would otherwise have to do in their head', () => {
    expect(formatTime12('14:00')).toBe('2:00 pm');
    expect(formatTime12('23:30')).toBe('11:30 pm');
  });

  it('keeps morning times in the am half', () => {
    expect(formatTime12('09:00')).toBe('9:00 am');
    expect(formatTime12('11:59')).toBe('11:59 am');
  });

  it('passes through a value it cannot parse rather than printing NaN', () => {
    expect(formatTime12('later')).toBe('later');
  });
});

describe('timeOptions', () => {
  it('covers a whole day at the given step', () => {
    expect(timeOptions(30)).toHaveLength(48);
    expect(timeOptions(60)).toHaveLength(24);
    expect(timeOptions(15)).toHaveLength(96);
  });

  it('starts at midnight and ends before it wraps', () => {
    const options = timeOptions(30);
    expect(options[0]).toEqual({ value: '00:00', label: '12:00 am' });
    expect(options.at(-1)).toEqual({ value: '23:30', label: '11:30 pm' });
  });

  it('never produces a duplicate value', () => {
    const values = timeOptions(30).map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('snapToStep', () => {
  it('snaps an off-grid time onto the nearest option', () => {
    // Without this a time saved by hand leaves the select showing nothing.
    expect(snapToStep('14:07', 30)).toBe('14:00');
    expect(snapToStep('14:20', 30)).toBe('14:30');
  });

  it('leaves a time already on the grid alone', () => {
    expect(snapToStep('14:30', 30)).toBe('14:30');
  });

  it('wraps rather than producing 24:00', () => {
    expect(snapToStep('23:50', 30)).toBe('00:00');
  });

  it('passes junk through untouched', () => {
    expect(snapToStep('later', 30)).toBe('later');
  });
});

describe('durationMinutes', () => {
  it('measures a slot inside one day', () => {
    expect(durationMinutes('09:00', '18:00')).toBe(9 * 60);
  });

  it('measures a night slot across midnight', () => {
    // The whole point: 19:00 to 06:00 is eleven hours, not minus thirteen.
    expect(durationMinutes('19:00', '06:00')).toBe(11 * 60);
  });

  it('treats an equal start and end as a full day', () => {
    expect(durationMinutes('12:00', '12:00')).toBe(24 * 60);
  });

  it('returns null when either end is not a time', () => {
    expect(durationMinutes('09:00', 'later')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('reads naturally at each shape', () => {
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(120)).toBe('2 hrs');
    expect(formatDuration(570)).toBe('9 hrs 30 min');
    expect(formatDuration(45)).toBe('45 min');
  });
});

describe('formatSlotRange', () => {
  it('shows the range and how long it runs', () => {
    expect(formatSlotRange('09:00', '18:00')).toBe('9:00 am – 6:00 pm · 9 hrs');
  });

  it('gets an overnight slot right', () => {
    expect(formatSlotRange('19:00', '06:00')).toBe('7:00 pm – 6:00 am · 11 hrs');
  });
});
