import { Prisma } from '@prisma/client';
import { addMoney, money, subtractMoney } from '../../common/money';

export type StayAmounts = {
  totalAmount: Prisma.Decimal | number | string;
  platformFee: Prisma.Decimal | number | string;
  refunded: Prisma.Decimal | number | string;
};

export type SettledStay = {
  gross: string;
  platformFee: string;
  refunded: string;
  net: string;
};

/**
 * What a host is owed for one stay.
 *
 * The guest's total already includes the platform fee, so the host's share is
 * the total minus that fee, minus anything refunded to the guest for the stay.
 *
 * The result is clamped at zero: if refunds exceed the host's share the
 * platform is owed money back, which is a recovery to chase separately — it
 * must never turn into a negative line that silently reduces another host's
 * transfer in the same batch.
 */
export function settleStay(stay: StayAmounts): SettledStay {
  const gross = money(stay.totalAmount);
  const platformFee = money(stay.platformFee);
  const refunded = money(stay.refunded);
  const afterFee = subtractMoney(gross, platformFee);
  const remaining = subtractMoney(afterFee, refunded);
  const net = remaining.isNegative() ? money(0) : remaining;

  return {
    gross: gross.toFixed(2),
    platformFee: platformFee.toFixed(2),
    refunded: refunded.toFixed(2),
    net: net.toFixed(2),
  };
}

export type StayTotals = {
  gross: string;
  platformFee: string;
  refunded: string;
  net: string;
};

export function sumStays(stays: SettledStay[]): StayTotals {
  const totals = stays.reduce(
    (acc, stay) => ({
      gross: addMoney(acc.gross, stay.gross),
      platformFee: addMoney(acc.platformFee, stay.platformFee),
      refunded: addMoney(acc.refunded, stay.refunded),
      net: addMoney(acc.net, stay.net),
    }),
    {
      gross: money(0),
      platformFee: money(0),
      refunded: money(0),
      net: money(0),
    },
  );

  return {
    gross: totals.gross.toFixed(2),
    platformFee: totals.platformFee.toFixed(2),
    refunded: totals.refunded.toFixed(2),
    net: totals.net.toFixed(2),
  };
}
