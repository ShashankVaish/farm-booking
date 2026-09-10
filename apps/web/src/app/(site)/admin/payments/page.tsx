'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, formatInr, isPublicPaymentView, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminPaymentView } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';
import Link from 'next/link';

/**
 * Mirrors the server rule: a payment that never moved money can be cleared,
 * anything captured or refunded is a financial record and stays.
 */
const DELETABLE_STATUSES = ['CREATED', 'FAILED', 'CANCELLED', 'EXPIRED'];

export default function AdminPaymentsPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '', hours: '' });
  const [applied, setApplied] = useState(draft);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPaymentView | null>(null);
  const [expireOpen, setExpireOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminPaymentView>>(
    () =>
      adminApi.payments({
        page,
        limit: 20,
        q: applied.q,
        hours: applied.hours ? Number(applied.hours) : undefined,
      }),
    [page, applied],
  );

  const items = (data?.items ?? []).filter(isPublicPaymentView);

  async function reconcile() {
    if (!reconcileId) return;
    setBusy(true);
    try {
      const result = await adminApi.reconcilePayment(reconcileId);
      notify(result.reconciled ? 'Payment reconciled.' : 'No change from the gateway.');
      setReconcileId(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Reconcile failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removePayment() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deletePayment(deleteTarget.id);
      notify('Payment record removed. The deletion is in the audit log.');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not remove this payment.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function expire() {
    setBusy(true);
    try {
      await adminApi.expireAbandonedPayments();
      notify('Abandoned payments expired.');
      setExpireOpen(false);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Expire job failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Money</p>
      <h1 className="t-h2">Payments</h1>
      <p className="t-body-small">
        Internal payment ID and gateway references only. Signatures, secrets, card numbers, and provider metadata are
        never returned by the API.
      </p>
      <div className={adminUi.actions}>
        <Button size="sm" variant="secondary" onClick={() => setExpireOpen(true)}>
          Expire abandoned
        </Button>
      </div>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Select
          id="pay-window"
          label="Time window"
          value={draft.hours}
          onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
        >
          <option value="">All time</option>
          <option value="7">Last 7 hours</option>
          <option value="24">Last 24 hours</option>
          <option value="168">Last 7 days</option>
          <option value="720">Last 30 days</option>
        </Select>
        <Input
          id="pay-q"
          label="Search"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Payment ID, gateway ID, or booking ID"
        />
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading payments">
        <AdminTable isEmpty={!items.length} emptyTitle="No payments" emptyDescription="Try another reference.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Internal ID</th>
                <th>Gateway payment</th>
                <th>Gateway order</th>
                <th>Booking</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((payment) => (
                <tr key={payment.id}>
                  <td className={adminUi.mono} data-label="Internal ID">{payment.id}</td>
                  <td className={adminUi.mono} data-label="Gateway payment">{payment.gatewayPaymentId ?? '—'}</td>
                  <td className={adminUi.mono} data-label="Gateway order">{payment.gatewayOrderId ?? '—'}</td>
                  <td data-label="Booking">
                    <Link href={`/admin/bookings/${payment.bookingId}`}>{payment.bookingId}</Link>
                  </td>
                  <td data-label="Amount">{formatInr(payment.amount)}</td>
                  <td data-label="Status">
                    <span className={adminUi.badge}>{statusLabel(payment.status)}</span>
                    <div className="t-caption">{formatDateTime(payment.createdAt)}</div>
                  </td>
                  <td data-label="Actions">
                    <div className={adminUi.actions}>
                      <Button size="sm" variant="ghost" onClick={() => setReconcileId(payment.id)}>
                        Reconcile
                      </Button>
                      {DELETABLE_STATUSES.includes(payment.status) ? (
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(payment)}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        <AdminPager meta={data?.meta} onPage={setPage} />
      </QueryGate>
      <ConfirmDialog
        open={Boolean(reconcileId)}
        title="Reconcile this payment?"
        description="The server will ask the gateway for the latest status. No client-side verification is trusted."
        confirmLabel="Reconcile"
        busy={busy}
        onClose={() => setReconcileId(null)}
        onConfirm={() => void reconcile()}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove this payment record?"
        description={
          deleteTarget
            ? `${statusLabel(deleteTarget.status)} attempt for ${formatInr(deleteTarget.amount)} will be deleted permanently. The deletion itself is written to the audit log. Captured and refunded payments cannot be removed.`
            : ''
        }
        confirmLabel="Delete record"
        danger
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void removePayment()}
      />
      <ConfirmDialog
        open={expireOpen}
        title="Expire abandoned payments?"
        description="Open or stale payment attempts past the hold window will be marked expired. This is audited."
        confirmLabel="Expire abandoned"
        danger
        busy={busy}
        onClose={() => setExpireOpen(false)}
        onConfirm={() => void expire()}
      />
    </div>
  );
}
