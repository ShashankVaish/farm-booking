'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Textarea } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminTable, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import {
  formatMonthlyPrice,
  listingLimitLabel,
  parseFeatureLines,
  type SubscriptionPlan,
} from '@/lib/plans/plans';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

const EMPTY_FORM = {
  name: '',
  description: '',
  monthlyPrice: '',
  listingLimit: '',
  features: '',
  sortOrder: '0',
  isFeatured: false,
  isActive: true,
};

type PlanForm = typeof EMPTY_FORM;

function toForm(plan: SubscriptionPlan): PlanForm {
  return {
    name: plan.name,
    description: plan.description ?? '',
    monthlyPrice: String(Number(plan.monthlyPrice)),
    listingLimit: plan.listingLimit == null ? '' : String(plan.listingLimit),
    features: plan.features.join('\n'),
    sortOrder: String(plan.sortOrder),
    isFeatured: plan.isFeatured,
    isActive: plan.isActive,
  };
}

export default function AdminPlansPage() {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAdminQuery<SubscriptionPlan[]>(() => adminApi.subscriptionPlans(), []);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);

  function startEdit(plan: SubscriptionPlan) {
    setEditingId(plan.id);
    setForm(toForm(plan));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const body = {
      name: form.name,
      description: form.description,
      monthlyPrice: Number(form.monthlyPrice),
      // Blank means unlimited; null clears an existing limit on edit.
      listingLimit: form.listingLimit.trim() ? Number(form.listingLimit) : null,
      features: parseFeatureLines(form.features),
      sortOrder: Number(form.sortOrder || 0),
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await adminApi.updateSubscriptionPlan(editingId, body);
        notify('Plan updated. This is audited.');
      } else {
        await adminApi.createSubscriptionPlan(body);
        notify('Plan created. This is audited.');
      }
      cancelEdit();
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save plan.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(plan: SubscriptionPlan) {
    setBusy(true);
    try {
      await adminApi.updateSubscriptionPlan(plan.id, { isActive: !plan.isActive });
      notify(plan.isActive ? 'Plan hidden from hosts. This is audited.' : 'Plan is live for hosts. This is audited.');
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update plan.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteSubscriptionPlan(deleteTarget.id);
      notify('Plan deleted. This is audited.');
      if (editingId === deleteTarget.id) cancelEdit();
      setDeleteTarget(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete plan.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Hosts</p>
      <h1 className="t-h2">Host plans</h1>
      <p className="t-body-small">
        Monthly listing plans shown to hosts on their Plans page. Hosts choose a plan by emailing support; nothing is
        charged online yet.
      </p>
      <form className={adminUi.panel} onSubmit={(event) => void save(event)} style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="t-h3">{editingId ? `Edit ${form.name || 'plan'}` : 'New plan'}</h2>
        <div className={adminUi.twoCol} style={{ marginTop: 'var(--space-4)' }}>
          <Input
            id="plan-name"
            label="Name"
            required
            minLength={2}
            maxLength={60}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            id="plan-description"
            label="Short description"
            maxLength={255}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            id="plan-price"
            label="Monthly price (₹)"
            type="number"
            min="0"
            step="0.01"
            required
            hint="0 shows the plan as Free."
            value={form.monthlyPrice}
            onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
          />
          <Input
            id="plan-limit"
            label="Listing limit"
            type="number"
            min="1"
            step="1"
            hint="Leave blank for unlimited."
            value={form.listingLimit}
            onChange={(e) => setForm({ ...form, listingLimit: e.target.value })}
          />
          <Textarea
            id="plan-features"
            label="Features"
            rows={5}
            hint="One per line, up to 12."
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
          />
          <Input
            id="plan-order"
            label="Display order"
            type="number"
            min="0"
            step="1"
            hint="Lower numbers show first."
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
        </div>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Checkbox
            id="plan-featured"
            label="Highlight as most popular"
            checked={form.isFeatured}
            onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
          />
          <Checkbox
            id="plan-active"
            label="Visible to hosts"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
        </div>
        <div className={adminUi.actions} style={{ marginTop: 'var(--space-4)' }}>
          <Button type="submit" disabled={busy}>
            {editingId ? 'Save plan' : 'Create plan'}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading plans">
        <div style={{ marginTop: 'var(--space-6)' }}>
          <AdminTable
            isEmpty={!data?.length}
            emptyTitle="No plans"
            emptyDescription="Create a plan and hosts will see it on their Plans page."
          >
            <table className={adminUi.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Listings</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.map((plan) => (
                  <tr key={plan.id}>
                    <td data-label="Plan">
                      {plan.name}
                      {plan.isFeatured ? <div className="t-caption">Most popular</div> : null}
                      {plan.description ? <div className="t-caption">{plan.description}</div> : null}
                    </td>
                    <td data-label="Price">
                      {formatMonthlyPrice(plan.monthlyPrice)}
                      {Number(plan.monthlyPrice) > 0 ? ' / month' : ''}
                    </td>
                    <td data-label="Listings">{listingLimitLabel(plan.listingLimit)}</td>
                    <td data-label="Order">{plan.sortOrder}</td>
                    <td data-label="Status">
                      <span className={adminUi.badge}>{plan.isActive ? 'Live' : 'Hidden'}</span>
                    </td>
                    <td>
                      <div className={adminUi.actions}>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(plan)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void toggleActive(plan)}>
                          {plan.isActive ? 'Hide' : 'Publish'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(plan)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        </div>
      </QueryGate>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete the ${deleteTarget?.name ?? ''} plan?`}
        description="Hosts will no longer see it. To take it down temporarily, hide it instead. This is audited."
        confirmLabel="Delete plan"
        danger
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
