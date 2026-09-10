import { settleStay, sumStays } from './payout-math';

describe('settleStay', () => {
  it('pays the host the guest total minus the platform fee', () => {
    // ₹12,600 paid, ₹600 platform fee (5% of ₹12,000 base).
    expect(settleStay({ totalAmount: 12600, platformFee: 600, refunded: 0 })).toEqual({
      gross: '12600.00',
      platformFee: '600.00',
      refunded: '0.00',
      net: '12000.00',
    });
  });

  it('subtracts a partial refund from the host share', () => {
    expect(
      settleStay({ totalAmount: 12600, platformFee: 600, refunded: 2000 }),
    ).toMatchObject({ net: '10000.00', refunded: '2000.00' });
  });

  it('never returns a negative payout when refunds exceed the host share', () => {
    // A full refund of a stay leaves nothing to pay out, not a negative
    // amount that would quietly offset another host in the same batch.
    expect(
      settleStay({ totalAmount: 12600, platformFee: 600, refunded: 12600 }),
    ).toMatchObject({ net: '0.00' });
  });

  it('keeps paise precision rather than drifting on floats', () => {
    expect(
      settleStay({ totalAmount: '228.90', platformFee: '10.90', refunded: '0' }),
    ).toMatchObject({ net: '218.00' });
    expect(
      settleStay({ totalAmount: '236.25', platformFee: '11.25', refunded: '0.05' }),
    ).toMatchObject({ net: '224.95' });
  });

  it('accepts decimal strings as stored by Prisma', () => {
    expect(
      settleStay({ totalAmount: '18900.00', platformFee: '900.00', refunded: '0.00' }),
    ).toMatchObject({ net: '18000.00' });
  });
});

describe('sumStays', () => {
  it('adds a batch without floating point drift', () => {
    const stays = [
      settleStay({ totalAmount: '228.90', platformFee: '10.90', refunded: '0' }),
      settleStay({ totalAmount: '236.25', platformFee: '11.25', refunded: '0' }),
      settleStay({ totalAmount: 12600, platformFee: 600, refunded: 0 }),
    ];
    expect(sumStays(stays)).toEqual({
      gross: '13065.15',
      platformFee: '622.15',
      refunded: '0.00',
      net: '12443.00',
    });
  });

  it('returns zeroes for a host with no stays in the window', () => {
    expect(sumStays([])).toEqual({
      gross: '0.00',
      platformFee: '0.00',
      refunded: '0.00',
      net: '0.00',
    });
  });
});
