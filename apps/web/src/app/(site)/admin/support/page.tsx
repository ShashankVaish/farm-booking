'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminTicket } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function AdminSupportPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '' });
  const [applied, setApplied] = useState(draft);
  const [pending, setPending] = useState<{ ticket: AdminTicket; status: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminTicket>>(
    () => adminApi.tickets({ page, limit: 20, q: applied.q }),
    [page, applied],
  );

  async function update() {
    if (!pending) return;
    setBusy(true);
    try {
      await adminApi.updateTicket(pending.ticket.id, pending.status);
      notify('Ticket updated. This is audited.');
      setPending(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update ticket.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Inbox</p>
      <h1 className="t-h2">Support</h1>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Input
          id="ticket-q"
          label="Search"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Subject or email"
        />
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading tickets">
        <AdminTable isEmpty={!data?.items.length} emptyTitle="No tickets" emptyDescription="Support threads will appear here.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>User</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    {ticket.subject}
                    <div className="t-caption">{ticket.message}</div>
                  </td>
                  <td>
                    {ticket.user?.name}
                    <div className="t-caption">{ticket.user?.email}</div>
                  </td>
                  <td>{statusLabel(ticket.priority)}</td>
                  <td>
                    <Select
                      id={`ticket-${ticket.id}`}
                      label="Status"
                      value={pending?.ticket.id === ticket.id ? pending.status : ticket.status}
                      onChange={(e) => setPending({ ticket, status: e.target.value })}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>{formatDateTime(ticket.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        <AdminPager meta={data?.meta} onPage={setPage} />
      </QueryGate>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Update ticket status?"
        description={
          pending
            ? `Move “${pending.ticket.subject}” to ${statusLabel(pending.status)}. Closing is audited.`
            : ''
        }
        confirmLabel="Update status"
        danger={pending?.status === 'CLOSED'}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void update()}
      />
    </div>
  );
}
