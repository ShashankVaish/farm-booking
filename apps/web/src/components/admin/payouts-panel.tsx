'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/forms';
import { EmptyState } from '@/components/ui/feedback';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDay, formatInr, statusLabel } from '@/lib/admin/format';
import type { AdminPayoutStatement, PayoutHost } from '@/lib/admin/types';
import { cn } from '@/lib/cn';
import styles from './payouts-panel.module.css';

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className={styles.field}>
      <p className={styles.fieldLabel}>{label}</p>
      <p className={cn(styles.fieldValue, mono && styles.mono, !value && styles.missing)}>
        {value || 'Not provided'}
      </p>
    </div>
  );
}

function HostCard({ host }: { host: PayoutHost }) {
  const [open, setOpen] = useState(false);
  const hasUpcoming = Number(host.upcoming) > 0;

  return (
    <article className={styles.host}>
      <div className={styles.hostHead}>
        <div style={{ minWidth: 0 }}>
          <h3 className={styles.hostName}>{host.owner.name}</h3>
          <p className={styles.hostMeta}>
            {host.owner.email}
            {host.owner.phone ? ` · ${host.owner.phone}` : ''}
          </p>
          <p className={styles.hostMeta}>
            {host.stayCount} stay{host.stayCount === 1 ? '' : 's'} · gross{' '}
            {formatInr(host.gross)} · fee {formatInr(host.platformFee)}
            {Number(host.refunded) > 0 ? ` · refunded ${formatInr(host.refunded)}` : ''}
          </p>
        </div>
        <div className={styles.amount}>
          <p className={styles.amountValue}>{formatInr(host.payableNow)}</p>
          <p className={styles.amountLabel}>Pay now</p>
          {hasUpcoming ? (
            <p className={styles.amountSecondary}>
              + {formatInr(host.upcoming)} upcoming
            </p>
          ) : null}
        </div>
      </div>

      {host.blockedReason ? (
        <p className={styles.blocked}>
          <span aria-hidden="true">⚠</span>
          Hold — {host.blockedReason}. Do not transfer until this is resolved.
        </p>
      ) : null}

      <div className={styles.bank}>
        <Field label="Account holder" value={host.bank.accountHolderName} />
        <Field label="Account number" value={host.bank.accountMasked} mono />
        <Field label="IFSC" value={host.bank.ifsc} mono />
        <Field label="Bank" value={host.bank.bankName} />
        <Field label="PAN" value={host.panNumber} mono />
        <Field label="KYC" value={statusLabel(host.kycStatus)} />
        <Field label="Phone verified" value={host.owner.phoneVerified ? 'Yes' : 'No'} />
      </div>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide' : 'Show'} {host.stayCount} stay{host.stayCount === 1 ? '' : 's'}
        {host.payableNowStays > 0 || host.upcomingStays > 0
          ? ` · ${host.payableNowStays} earned, ${host.upcomingStays} upcoming`
          : ''}
      </button>

      {open ? (
        <div className={styles.stays}>
          {host.stays.map((stay) => (
            <div key={stay.bookingId} className={styles.stay}>
              <div className={styles.stayTitle}>
                {stay.property}
                <div className={styles.stayDates}>
                  {stay.city} · {stay.guest} · {stay.guests} guest
                  {stay.guests === 1 ? '' : 's'}
                </div>
              </div>
              <div>
                <div className={styles.stayDates}>
                  {formatDay(stay.checkIn)} → {formatDay(stay.checkOut)}
                  <span className={stay.settled ? styles.tagEarned : styles.tagUpcoming}>
                    {stay.settled ? 'Earned' : 'Upcoming'}
                  </span>
                </div>
                <div className={styles.stayAmounts}>
                  <span>gross {formatInr(stay.gross)}</span>
                  <span>fee {formatInr(stay.platformFee)}</span>
                  {Number(stay.refunded) > 0 ? <span>refund {formatInr(stay.refunded)}</span> : null}
                </div>
              </div>
              <div className={styles.stayNet}>{formatInr(stay.net)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function PayoutsPanel() {
  const [date, setDate] = useState(todayIso());
  // Empty means the whole outstanding ledger, which is the useful default.
  const [days, setDays] = useState('');
  const [applied, setApplied] = useState<{ date?: string; days?: number }>({});

  const { data, error, loading, reload } = useAdminQuery<AdminPayoutStatement>(
    () => adminApi.payouts(applied),
    [applied],
  );

  return (
    <div>
      <p className="t-label">Finance</p>
      <h1 className="t-h2">Host payouts</h1>
      <p className="t-body-small" style={{ marginTop: 'var(--space-2)', maxWidth: '48rem' }}>
        Everything owed to each host, with their bank details. <strong>Pay now</strong> is money
        already earned — the guest has checked out. <strong>Upcoming</strong> is paid and
        confirmed but the stay has not happened yet, so it is not safe to transfer until the
        guest arrives. Amounts are the guest total less the platform fee and any refund.
      </p>

      <div className={styles.controls}>
        <Select
          id="payout-days"
          label="Period"
          value={days}
          onChange={(event) => setDays(event.target.value)}
        >
          <option value="">Everything owed</option>
          <option value="1">Checkouts in 24 hours</option>
          <option value="7">Checkouts in 7 days</option>
          <option value="30">Checkouts in 30 days</option>
        </Select>
        <Input
          id="payout-date"
          label="Window ends"
          type="date"
          value={date}
          disabled={days === ''}
          onChange={(event) => setDate(event.target.value)}
          hint={days === '' ? 'Only used with a period' : undefined}
        />
        <Button
          onClick={() =>
            setApplied(days === '' ? {} : { date, days: Number(days) })
          }
        >
          Show statement
        </Button>
      </div>

      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading payouts">
        {data ? (
          <>
            <dl className={styles.summary}>
              <div className={cn(styles.summaryCell, styles.payable)}>
                <dt>Ready to pay</dt>
                <dd>{formatInr(data.totals.readyToPay)}</dd>
              </div>
              <div className={cn(styles.summaryCell, styles.hold)}>
                <dt>Earned, on hold</dt>
                <dd>{formatInr(data.totals.onHold)}</dd>
              </div>
              <div className={styles.summaryCell}>
                <dt>Upcoming stays</dt>
                <dd>{formatInr(data.totals.upcoming)}</dd>
              </div>
              <div className={styles.summaryCell}>
                <dt>Platform fee</dt>
                <dd>{formatInr(data.totals.platformFee)}</dd>
              </div>
            </dl>

            <p className="t-body-small" style={{ marginBottom: 'var(--space-4)' }}>
              {data.windowed && data.from && data.to
                ? `Checkouts ${data.from === data.to ? data.from : `${data.from} → ${data.to}`}`
                : 'All outstanding'}{' '}
              · as of {data.asOf} · {data.totals.hosts} host
              {data.totals.hosts === 1 ? '' : 's'} · {data.totals.stays} stay
              {data.totals.stays === 1 ? '' : 's'} · total {formatInr(data.totals.netPayable)}
            </p>

            {data.hosts.length === 0 ? (
              <EmptyState
                title="Nothing to settle"
                description="No paid, confirmed booking exists yet, so no host is owed anything. Bookings still awaiting payment do not count."
              />
            ) : (
              <div className={styles.hosts}>
                {data.hosts.map((host) => (
                  <HostCard key={host.owner.id} host={host} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </QueryGate>
    </div>
  );
}
