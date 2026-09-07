'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminProperty } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

type Moderation = 'approve' | 'reject' | 'request-changes' | 'suspend' | 'restore';

const NEEDS_REASON: Moderation[] = ['reject', 'request-changes', 'suspend'];

function actionsFor(status: string): Array<{ id: Moderation; label: string; danger?: boolean }> {
  switch (status) {
    case 'PENDING_APPROVAL':
      return [
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject', danger: true },
        { id: 'request-changes', label: 'Request changes' },
      ];
    case 'CHANGES_REQUESTED':
      return [
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject', danger: true },
      ];
    case 'APPROVED':
      return [{ id: 'suspend', label: 'Suspend', danger: true }];
    case 'SUSPENDED':
      return [{ id: 'restore', label: 'Restore' }];
    case 'REJECTED':
      return [{ id: 'request-changes', label: 'Request changes' }];
    default:
      return [];
  }
}

export default function AdminPropertiesPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '', status: 'PENDING_APPROVAL' });
  const [applied, setApplied] = useState(draft);
  const [target, setTarget] = useState<{ property: AdminProperty; action: Moderation } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminProperty>>(
    () => adminApi.properties({ page, limit: 20, q: applied.q, status: applied.status || undefined }),
    [page, applied],
  );

  async function run(reason?: string) {
    if (!target) return;
    setBusy(true);
    const { property, action } = target;
    try {
      if (action === 'approve') await adminApi.approveProperty(property.id);
      if (action === 'reject') await adminApi.rejectProperty(property.id, reason ?? '');
      if (action === 'request-changes') await adminApi.requestPropertyChanges(property.id, reason ?? '');
      if (action === 'suspend') await adminApi.suspendProperty(property.id, reason ?? '');
      if (action === 'restore') await adminApi.restoreProperty(property.id);
      notify(`${statusLabel(action)} recorded in the audit log.`);
      setTarget(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Moderation failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Moderation</p>
      <h1 className="t-h2">Properties</h1>
      <p className="t-body-small">
        Approve, reject, request changes, suspend, or restore. Reasons are required where they change listing visibility.
      </p>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Input id="prop-q" label="Search" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        <Select
          id="prop-status"
          label="Status"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="CHANGES_REQUESTED">Changes requested</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DRAFT">Draft</option>
        </Select>
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading properties">
        <AdminTable isEmpty={!data?.items.length} emptyTitle="No properties" emptyDescription="Nothing matches this filter.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((property) => (
                <tr key={property.id}>
                  <td>
                    {property.title}
                    <div className="t-caption">
                      {property.city}, {property.state}
                    </div>
                  </td>
                  <td>
                    {property.owner?.name}
                    <div className="t-caption">{property.owner?.email}</div>
                  </td>
                  <td>
                    <span className={adminUi.badge}>{statusLabel(property.status)}</span>
                  </td>
                  <td>{formatDateTime(property.createdAt)}</td>
                  <td>
                    <div className={adminUi.actions}>
                      {actionsFor(property.status).map((action) => (
                        <Button
                          key={action.id}
                          size="sm"
                          variant={action.danger ? 'danger' : 'secondary'}
                          onClick={() => setTarget({ property, action: action.id })}
                        >
                          {action.label}
                        </Button>
                      ))}
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
        open={Boolean(target)}
        title={target ? `${statusLabel(target.action)} this listing?` : ''}
        description={
          target
            ? `${target.property.title} will change status. The owner is notified and the action is audited.`
            : ''
        }
        confirmLabel={target ? statusLabel(target.action) : 'Confirm'}
        danger={target ? NEEDS_REASON.includes(target.action) && target.action !== 'request-changes' : false}
        reasonRequired={target ? NEEDS_REASON.includes(target.action) : false}
        busy={busy}
        onClose={() => setTarget(null)}
        onConfirm={(reason) => void run(reason)}
      />
    </div>
  );
}
