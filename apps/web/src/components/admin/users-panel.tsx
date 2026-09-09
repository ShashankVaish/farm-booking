'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi, type AdminListQuery } from '@/lib/admin/api';
import { formatDateTime, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminUser } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

export function UsersPanel({ ownersOnly = false }: { ownersOnly?: boolean }) {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({
    q: '',
    role: '',
    status: '',
    registeredFrom: '',
    registeredTo: '',
  });
  const [applied, setApplied] = useState(draft);
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const query: AdminListQuery = {
    page,
    limit: 20,
    q: applied.q,
    status: applied.status || undefined,
    role: ownersOnly ? undefined : applied.role || undefined,
    registeredFrom: applied.registeredFrom || undefined,
    registeredTo: applied.registeredTo || undefined,
  };

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminUser>>(
    () => (ownersOnly ? adminApi.owners(query) : adminApi.users(query)),
    [page, applied, ownersOnly],
  );

  async function toggleActive() {
    if (!pending) return;
    setBusy(true);
    try {
      await adminApi.setUserActive(pending.id, !pending.isActive);
      notify(pending.isActive ? 'Account disabled. This is audited.' : 'Account enabled. This is audited.');
      setPending(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update the account.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Directory</p>
      <h1 className="t-h2">{ownersOnly ? 'Owners' : 'Users'}</h1>
      <p className="t-body-small">
        Search and filter accounts. Enable or disable is enforced on the server and written to the audit log.
      </p>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Input
          id="user-q"
          label="Search"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Name or email"
        />
        {ownersOnly ? null : (
          <Select
            id="user-role"
            label="Role"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          >
            <option value="">All roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
          </Select>
        )}
        <Select
          id="user-status"
          label="Status"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </Select>
        <Input
          id="user-from"
          label="Registered from"
          type="date"
          value={draft.registeredFrom}
          onChange={(e) => setDraft({ ...draft, registeredFrom: e.target.value })}
        />
        <Input
          id="user-to"
          label="Registered to"
          type="date"
          value={draft.registeredTo}
          onChange={(e) => setDraft({ ...draft, registeredTo: e.target.value })}
        />
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading users">
        <AdminTable
          isEmpty={!data?.items.length}
          emptyTitle="No accounts"
          emptyDescription="Try a different search or date range."
        >
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={adminUi.badge}>{statusLabel(user.role)}</span>
                  </td>
                  <td>{user.isActive ? 'Active' : 'Disabled'}</td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>
                    <Button size="sm" variant={user.isActive ? 'danger' : 'secondary'} onClick={() => setPending(user)}>
                      {user.isActive ? 'Disable' : 'Enable'}
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
        open={Boolean(pending)}
        title={pending?.isActive ? 'Disable this account?' : 'Enable this account?'}
        description={
          pending?.isActive
            ? `${pending?.email} will not be able to sign in. This action is audited.`
            : `${pending?.email} will be able to sign in again. This action is audited.`
        }
        confirmLabel={pending?.isActive ? 'Disable account' : 'Enable account'}
        danger={pending?.isActive}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void toggleActive()}
      />
    </div>
  );
}
