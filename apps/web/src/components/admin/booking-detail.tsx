'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import {
  formatDateTime,
  formatDay,
  formatInr,
  isPublicPaymentView,
  refundFailureHint,
  statusLabel,
} from '@/lib/admin/format';
import type { AdminBooking } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAdminQuery<AdminBooking>(() => adminApi.booking(bookingId), [bookingId]);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [blockDates, setBlockDates] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function refund(reason?: string) {
    setBusy(true);
    try {
      const parsed = amount.trim() ? Number(amount) : undefined;
      await adminApi.requestRefund(bookingId, reason ?? '', parsed);
      notify('Refund requested. This is audited.');
      setRefundOpen(false);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Refund failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking(reason?: string) {
    setBusy(true);
    try {
      const result = await adminApi.cancelBooking(bookingId, reason ?? '', blockDates);
      notify(
        result.blockedDates > 0
          ? `Booking cancelled, refund started, ${result.blockedDates} night(s) blocked.`
          : 'Booking cancelled and refund started.',
      );
      setCancelOpen(false);
      setBlockDates(false);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Cancellation failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const cancellable =
    data?.status === 'CONFIRMED' ||
    data?.status === 'PENDING' ||
    data?.status === 'PAYMENT_PENDING';

  return (
    <QueryGate loading={loading} error={error} onRetry={reload} label="Loading booking">
      {data ? (
        <div>
          <p className="t-label">
            <Link href="/admin/bookings">Bookings</Link>
          </p>
          <h1 className="t-h2">{data.property.title}</h1>
          <p className="t-caption">
            {statusLabel(data.status)} · {formatDay(data.dates.checkIn)} → {formatDay(data.dates.checkOut)}
          </p>

          <div className={adminUi.twoCol} style={{ marginTop: 'var(--space-6)' }}>
            <section className={adminUi.panel}>
              <h2 className="t-h3">People</h2>
              <dl className={adminUi.dl} style={{ marginTop: 'var(--space-4)' }}>
                <dt className="t-caption">Customer</dt>
                <dd>
                  {data.customer.name}
                  <div className="t-caption">{data.customer.email}</div>
                </dd>
                <dt className="t-caption">Owner</dt>
                <dd>
                  {data.owner.name}
                  <div className="t-caption">{data.owner.email}</div>
                </dd>
                <dt className="t-caption">Property</dt>
                <dd>
                  {data.property.title}
                  <div className="t-caption">
                    {[data.property.city, data.property.state].filter(Boolean).join(', ')}
                  </div>
                </dd>
              </dl>
            </section>
            <section className={adminUi.panel}>
              <h2 className="t-h3">Stay & amount</h2>
              <dl className={adminUi.dl} style={{ marginTop: 'var(--space-4)' }}>
                <dt className="t-caption">Dates</dt>
                <dd>
                  {formatDay(data.dates.checkIn)} → {formatDay(data.dates.checkOut)} · {data.guestCount} guests
                </dd>
                <dt className="t-caption">Total</dt>
                <dd>{formatInr(data.amount.total)}</dd>
                <dt className="t-caption">Platform fee</dt>
                <dd>{formatInr(data.amount.platformFee)}</dd>
                <dt className="t-caption">Discount</dt>
                <dd>{formatInr(data.amount.discount)}</dd>
                <dt className="t-caption">Cancellation</dt>
                <dd>{data.cancellation ? formatDateTime(data.cancellation.cancelledAt) : 'None'}</dd>
              </dl>
            </section>
          </div>

          <section className={adminUi.panel} style={{ marginTop: 'var(--space-5)' }}>
            <h2 className="t-h3">Payments</h2>
            <p className="t-caption">Internal IDs and gateway references only. Card, CVV, signatures, and secrets are never shown.</p>
            {data.payments.length === 0 ? (
              <p className="t-body-small">No payments yet.</p>
            ) : (
              <table className={adminUi.table} style={{ marginTop: 'var(--space-4)' }}>
                <thead>
                  <tr>
                    <th>Internal ID</th>
                    <th>Gateway payment</th>
                    <th>Gateway order</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.filter(isPublicPaymentView).map((payment) => (
                    <tr key={payment.id}>
                      <td className={adminUi.mono} data-label="Internal ID">{payment.id}</td>
                      <td className={adminUi.mono} data-label="Gateway payment">{payment.gatewayPaymentId ?? '—'}</td>
                      <td className={adminUi.mono} data-label="Gateway order">{payment.gatewayOrderId ?? '—'}</td>
                      <td data-label="Amount">{formatInr(payment.amount)}</td>
                      <td data-label="Status">
                        <span className={adminUi.badge}>{statusLabel(payment.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className={adminUi.actions} style={{ marginTop: 'var(--space-4)' }}>
              <Button size="sm" variant="danger" onClick={() => setRefundOpen(true)}>
                Request refund
              </Button>
              {cancellable ? (
                <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
                  Cancel booking
                </Button>
              ) : null}
            </div>
          </section>

          <section className={adminUi.panel} style={{ marginTop: 'var(--space-5)' }}>
            <h2 className="t-h3">Refunds</h2>
            {data.refunds.length === 0 ? (
              <p className="t-body-small">No refunds.</p>
            ) : (
              <table className={adminUi.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Gateway refund</th>
                    <th>Gateway response</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.refunds.map((refundRow) => (
                    <tr key={refundRow.id}>
                      <td className={adminUi.mono} data-label="ID">{refundRow.id}</td>
                      <td data-label="Amount">{formatInr(refundRow.amount)}</td>
                      <td data-label="Status">{statusLabel(refundRow.status)}</td>
                      <td className={adminUi.mono} data-label="Gateway refund">{refundRow.gatewayRefundId ?? '—'}</td>
                      <td
                        style={
                          refundRow.status === 'FAILED'
                            ? { color: 'var(--color-error)' }
                            : undefined
                        }
                       data-label="Gateway response">
                        {refundRow.gatewayStatus ?? '—'}
                        {refundRow.status === 'FAILED' && refundFailureHint(refundRow.gatewayStatus) ? (
                          <div className="t-caption" style={{ color: 'var(--color-text-secondary)' }}>
                            {refundFailureHint(refundRow.gatewayStatus)}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Reason">{refundRow.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <ConfirmDialog
            open={cancelOpen}
            title="Cancel this booking?"
            description="The stay is cancelled, the nights are released, and a refund is sent to the guest's original payment method at the fastest speed the gateway allows. This cannot be undone."
            confirmLabel="Cancel booking"
            danger
            reasonRequired
            busy={busy}
            onClose={() => setCancelOpen(false)}
            onConfirm={(reason) => void cancelBooking(reason)}
          >
            <Checkbox
              id="cancel-block-dates"
              label="Also block these nights so the stay is not rebooked"
              checked={blockDates}
              onChange={(e) => setBlockDates(e.target.checked)}
            />
          </ConfirmDialog>

          <ConfirmDialog
            open={refundOpen}
            title="Request a refund?"
            description="This talks to the payment provider from the server. Card data is never stored or displayed."
            confirmLabel="Request refund"
            danger
            reasonRequired
            busy={busy}
            onClose={() => setRefundOpen(false)}
            onConfirm={(reason) => void refund(reason)}
          >
            <Input
              id="refund-amount"
              label="Amount (optional)"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              hint="Leave blank to refund the captured amount."
            />
          </ConfirmDialog>
        </div>
      ) : null}
    </QueryGate>
  );
}
