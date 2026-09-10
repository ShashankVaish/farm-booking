'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDay, formatInr } from '@/lib/admin/format';
import type { AdminCoupon, AdminList } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

export default function AdminCouponsPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminCoupon>>(
    () => adminApi.coupons({ page, limit: 20 }),
    [page],
  );
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminCoupon | null>(null);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    startsAt: '',
    endsAt: '',
  });

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await adminApi.createCoupon({
        code: form.code,
        description: form.description || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      });
      notify('Coupon created. This is audited.');
      setForm({ ...form, code: '', description: '' });
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create coupon.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!toggleTarget) return;
    setBusy(true);
    try {
      await adminApi.updateCoupon(toggleTarget.id, { isActive: !toggleTarget.isActive });
      notify('Coupon updated. This is audited.');
      setToggleTarget(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update coupon.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteId) return;
    setBusy(true);
    try {
      await adminApi.deleteCoupon(deleteId);
      notify('Coupon deleted. This is audited.');
      setDeleteId(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete coupon.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Promotions</p>
      <h1 className="t-h2">Coupons</h1>
      <form className={adminUi.panel} onSubmit={(event) => void create(event)} style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="t-h3">New coupon</h2>
        <div className={adminUi.twoCol} style={{ marginTop: 'var(--space-4)' }}>
          <Input id="c-code" label="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input
            id="c-desc"
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select
            id="c-type"
            label="Type"
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value })}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed</option>
          </Select>
          <Input
            id="c-value"
            label="Value"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.discountValue}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
          />
          <Input
            id="c-start"
            label="Starts"
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          />
          <Input
            id="c-end"
            label="Ends"
            type="datetime-local"
            required
            value={form.endsAt}
            onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
          />
        </div>
        <div className={adminUi.actions} style={{ marginTop: 'var(--space-4)' }}>
          <Button type="submit" disabled={busy}>
            Create coupon
          </Button>
        </div>
      </form>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading coupons">
        <div style={{ marginTop: 'var(--space-6)' }}>
          <AdminTable isEmpty={!data?.items.length} emptyTitle="No coupons" emptyDescription="Create a code to start.">
            <table className={adminUi.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Window</th>
                  <th>Redemptions</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((coupon) => (
                  <tr key={coupon.id}>
                    <td data-label="Code">
                      {coupon.code}
                      <div className="t-caption">{coupon.description}</div>
                    </td>
                    <td data-label="Discount">
                      {coupon.discountType === 'PERCENTAGE'
                        ? `${coupon.discountValue}%`
                        : formatInr(coupon.discountValue)}
                    </td>
                    <td data-label="Window">
                      {formatDay(coupon.startsAt)} → {formatDay(coupon.endsAt)}
                    </td>
                    <td data-label="Redemptions">
                      {coupon.redemptionCount}
                      {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}
                    </td>
                    <td data-label="Status">
                      <span className={adminUi.badge}>{coupon.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td>
                      <div className={adminUi.actions}>
                        <Button size="sm" variant="secondary" onClick={() => setToggleTarget(coupon)}>
                          {coupon.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteId(coupon.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
          <AdminPager meta={data?.meta} onPage={setPage} />
        </div>
      </QueryGate>
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={toggleTarget?.isActive ? 'Deactivate this coupon?' : 'Activate this coupon?'}
        description="Code availability changes immediately. This action is audited."
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        danger={Boolean(toggleTarget?.isActive)}
        busy={busy}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => void toggle()}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this coupon?"
        description="Existing bookings keep their discount. This action is audited."
        confirmLabel="Delete coupon"
        danger
        busy={busy}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
