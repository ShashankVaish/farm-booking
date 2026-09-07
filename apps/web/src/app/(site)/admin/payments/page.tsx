'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, formatInr, isPublicPaymentView, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminPaymentView } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';
import Link from 'next/link';

export default function AdminPaymentsPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '' });
  const [applied, setApplied] = useState(draft);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [expireOpen, setExpireOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminPaymentView>>(
    () => adminApi.payments({ page, limit: 20, q: applied.q }),
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
                  <td className={adminUi.mono}>{payment.id}</td>
                  <td className={adminUi.mono}>{payment.gatewayPaymentId ?? '—'}</td>
                  <td className={adminUi.mono}>{payment.gatewayOrderId ?? '—'}</td>
                  <td>
                    <Link href={`/admin/bookings/${payment.bookingId}`}>{payment.bookingId}</Link>
                  </td>
                  <td>{formatInr(payment.amount)}</td>
                  <td>
                    <span className={adminUi.badge}>{statusLabel(payment.status)}</span>
                    <div className="t-caption">{formatDateTime(payment.createdAt)}</div>
                  </td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => setReconcileId(payment.id)}>
                      Reconcile
                    </Button>
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
