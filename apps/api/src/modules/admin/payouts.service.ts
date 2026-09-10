import { Injectable } from '@nestjs/common';
import { BookingStatus, KycStatus, RefundStatus } from '@prisma/client';
import { toUtcDateOnly } from '../../common/dates';
import { addMoney, money, subtractMoney } from '../../common/money';
import { PrismaService } from '../../prisma/prisma.service';
import { settleStay, sumStays } from './payout-math';
import { AdminPayoutsQueryDto } from './dto/admin.dto';

const EARNED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

/** Only the last four digits of an account number are ever shown. */
function maskAccount(last4: string | null | undefined): string | null {
  return last4 ? `••••••${last4}` : null;
}

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the platform owes each host.
   *
   * By default this is the full outstanding ledger - every paid, confirmed
   * stay - because the question an operator actually asks is "how much do I
   * owe this host", not "what closed in the last 24 hours". A date window can
   * be supplied to narrow it to a single settlement run.
   *
   * Each host's money is split by whether the stay has finished:
   *   payableNow - the guest has checked out, so the money is earned and due
   *   upcoming   - paid and confirmed, but the stay has not happened yet
   *
   * Paying out `upcoming` early is what leaves a platform exposed when a guest
   * cancels, so the two are never merged into one "pay this" figure.
   *
   * Host net = what the guest paid, minus the platform fee, minus any refund.
   */
  async statement(query: AdminPayoutsQueryDto) {
    const windowed = Boolean(query.days);
    const to = query.date ? toUtcDateOnly(query.date) : toUtcDateOnly(new Date());
    const days = Math.min(Math.max(query.days ?? 1, 1), 365);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    // Checkouts on the end date itself are included.
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    // A stay with a check-out date up to and including today is earned.
    const today = toUtcDateOnly(new Date());
    const earnedCutoff = new Date(today);
    earnedCutoff.setUTCDate(earnedCutoff.getUTCDate() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: EARNED_STATUSES },
        ...(windowed ? { checkOutDate: { gte: from, lt: toExclusive } } : {}),
      },
      select: {
        id: true,
        checkInDate: true,
        checkOutDate: true,
        guestCount: true,
        totalAmount: true,
        platformFee: true,
        currency: true,
        status: true,
        customer: { select: { name: true } },
        refunds: {
          where: { status: RefundStatus.COMPLETED },
          select: { amount: true },
        },
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                phoneVerifiedAt: true,
                ownerProfile: {
                  select: {
                    bankAccountName: true,
                    bankAccountLast4: true,
                    bankIfsc: true,
                    bankName: true,
                    kycStatus: true,
                    panNumber: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { checkOutDate: 'asc' },
    });

    type HostRow = {
      owner: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        phoneVerified: boolean;
      };
      bank: {
        accountHolderName: string | null;
        accountMasked: string | null;
        ifsc: string | null;
        bankName: string | null;
        onFile: boolean;
      };
      kycStatus: KycStatus;
      panNumber: string | null;
      stays: Array<{
        bookingId: string;
        property: string;
        city: string;
        guest: string;
        checkIn: Date;
        checkOut: Date;
        guests: number;
        /** True once the guest has checked out, i.e. the money is earned. */
        settled: boolean;
        gross: string;
        platformFee: string;
        refunded: string;
        net: string;
      }>;
      currency: string;
    };

    const byHost = new Map<string, HostRow>();

    for (const booking of bookings) {
      const owner = booking.property.owner;
      const profile = owner.ownerProfile;

      if (!byHost.has(owner.id)) {
        byHost.set(owner.id, {
          owner: {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
            phoneVerified: Boolean(owner.phoneVerifiedAt),
          },
          bank: {
            accountHolderName: profile?.bankAccountName ?? null,
            accountMasked: maskAccount(profile?.bankAccountLast4),
            ifsc: profile?.bankIfsc ?? null,
            bankName: profile?.bankName ?? null,
            onFile: Boolean(profile?.bankAccountLast4),
          },
          kycStatus: profile?.kycStatus ?? KycStatus.NOT_SUBMITTED,
          panNumber: profile?.panNumber ?? null,
          stays: [],
          currency: booking.currency,
        });
      }

      const refunded = booking.refunds.reduce(
        (sum, refund) => addMoney(sum, refund.amount),
        money(0),
      );
      const settled = settleStay({
        totalAmount: booking.totalAmount,
        platformFee: booking.platformFee,
        refunded,
      });

      byHost.get(owner.id)!.stays.push({
        bookingId: booking.id,
        property: booking.property.title,
        city: booking.property.city,
        guest: booking.customer.name,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        guests: booking.guestCount,
        settled: booking.checkOutDate < earnedCutoff,
        ...settled,
      });
    }

    const hosts = [...byHost.values()]
      .map((host) => {
        const finished = host.stays.filter((stay) => stay.settled);
        const future = host.stays.filter((stay) => !stay.settled);
        const totals = sumStays(host.stays);
        const earned = sumStays(finished);
        const pending = sumStays(future);

        return {
          ...host,
          stayCount: host.stays.length,
          gross: totals.gross,
          platformFee: totals.platformFee,
          refunded: totals.refunded,
          /** Earned and due now. */
          payableNow: earned.net,
          payableNowStays: finished.length,
          /** Paid by the guest, but the stay has not happened yet. */
          upcoming: pending.net,
          upcomingStays: future.length,
          /** Everything, earned or not. */
          netPayable: totals.net,
          /** A transfer should not be attempted without verified bank details. */
          payable:
            host.bank.onFile && host.kycStatus === KycStatus.VERIFIED,
          blockedReason: !host.bank.onFile
            ? 'No bank account on file'
            : host.kycStatus !== KycStatus.VERIFIED
              ? `KYC ${host.kycStatus.toLowerCase().replace(/_/g, ' ')}`
              : null,
        };
      })
      .sort(
        (a, b) =>
          Number(b.payableNow) - Number(a.payableNow) ||
          Number(b.netPayable) - Number(a.netPayable),
      );

    const totals = hosts.reduce(
      (acc, host) => ({
        gross: addMoney(acc.gross, host.gross),
        platformFee: addMoney(acc.platformFee, host.platformFee),
        refunded: addMoney(acc.refunded, host.refunded),
        net: addMoney(acc.net, host.netPayable),
        payableNow: addMoney(acc.payableNow, host.payableNow),
        upcoming: addMoney(acc.upcoming, host.upcoming),
        // Earned money only, and only for hosts who clear the checks.
        ready: addMoney(acc.ready, host.payable ? host.payableNow : 0),
      }),
      {
        gross: money(0),
        platformFee: money(0),
        refunded: money(0),
        net: money(0),
        payableNow: money(0),
        upcoming: money(0),
        ready: money(0),
      },
    );

    return {
      /** Null when the statement covers everything owed rather than a window. */
      from: windowed ? from.toISOString().slice(0, 10) : null,
      to: windowed ? to.toISOString().slice(0, 10) : null,
      days: windowed ? days : null,
      windowed,
      asOf: today.toISOString().slice(0, 10),
      currency: 'INR',
      totals: {
        hosts: hosts.length,
        stays: hosts.reduce((sum, host) => sum + host.stayCount, 0),
        gross: totals.gross.toFixed(2),
        platformFee: totals.platformFee.toFixed(2),
        refunded: totals.refunded.toFixed(2),
        netPayable: totals.net.toFixed(2),
        /** Earned: the guest has checked out. */
        payableNow: totals.payableNow.toFixed(2),
        /** Paid, but the stay has not happened yet. */
        upcoming: totals.upcoming.toFixed(2),
        /** Earned money for hosts who pass bank and KYC checks. */
        readyToPay: totals.ready.toFixed(2),
        /** Earned money blocked on missing bank details or KYC. */
        onHold: subtractMoney(totals.payableNow, totals.ready).toFixed(2),
      },
      hosts,
    };
  }
}
