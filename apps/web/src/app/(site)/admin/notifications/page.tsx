'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/forms';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminNotification } from '@/lib/admin/types';

export default function AdminNotificationsPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '' });
  const [applied, setApplied] = useState(draft);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminNotification>>(
    () => adminApi.notifications({ page, limit: 20, q: applied.q }),
    [page, applied],
  );

  return (
    <div>
      <p className="t-label">Delivery</p>
      <h1 className="t-h2">Notifications</h1>
      <p className="t-body-small">Platform notices sent to customers and owners. Content is read-only here.</p>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Input
          id="note-q"
          label="Search"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Title, type, or email"
        />
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading notifications">
        <AdminTable isEmpty={!data?.items.length} emptyTitle="No notifications" emptyDescription="Sent notices will appear here.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Recipient</th>
                <th>Read</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((note) => (
                <tr key={note.id}>
                  <td data-label="Type">
                    <span className={adminUi.badge}>{statusLabel(note.type)}</span>
                  </td>
                  <td data-label="Title">
                    {note.title}
                    <div className="t-caption">{note.body}</div>
                  </td>
                  <td data-label="Recipient">
                    {note.user?.name}
                    <div className="t-caption">{note.user?.email}</div>
                  </td>
                  <td data-label="Read">{note.readAt ? formatDateTime(note.readAt) : 'Unread'}</td>
                  <td data-label="Sent">{formatDateTime(note.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
        <AdminPager meta={data?.meta} onPage={setPage} />
      </QueryGate>
    </div>
  );
}
