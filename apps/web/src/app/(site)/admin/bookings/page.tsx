'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Input, Select } from '@/components/ui/forms';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDay, formatInr, statusLabel } from '@/lib/admin/format';
import type { AdminBooking, AdminList } from '@/lib/admin/types';

export default function AdminBookingsPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '', status: '' });
  const [applied, setApplied] = useState(draft);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminBooking>>(
    () => adminApi.bookings({ page, limit: 20, q: applied.q, status: applied.status || undefined }),
    [page, applied],
  );

  return (
    <div>
      <p className="t-label">Reservations</p>
      <h1 className="t-h2">Bookings</h1>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Input
          id="booking-q"
          label="Search"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Guest, owner, or listing"
        />
        <Select
          id="booking-status"
          label="Status"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="PAYMENT_PENDING">Payment pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="EXPIRED">Expired</option>
          <option value="REFUNDED">Refunded</option>
        </Select>
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading bookings">
        <AdminTable isEmpty={!data?.items.length} emptyTitle="No bookings" emptyDescription="Nothing matches this filter.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Property</th>
                <th>Customer</th>
                <th>Owner</th>
                <th>Dates</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((booking) => (
                <tr key={booking.id}>
                  <td data-label="Property">
                    <Link href={`/admin/bookings/${booking.id}`}>{booking.property.title}</Link>
                  </td>
                  <td data-label="Customer">
                    {booking.customer.name}
                    <div className="t-caption">{booking.customer.email}</div>
                  </td>
                  <td data-label="Owner">
                    {booking.owner.name}
                    <div className="t-caption">{booking.owner.email}</div>
                  </td>
                  <td data-label="Dates">
                    {formatDay(booking.dates.checkIn)} → {formatDay(booking.dates.checkOut)}
                  </td>
                  <td data-label="Amount">{formatInr(booking.amount.total)}</td>
                  <td data-label="Payment">
                    {booking.payment ? (
                      <>
                        <span className={adminUi.badge}>{statusLabel(booking.payment.status)}</span>
                        <div className={adminUi.mono}>{booking.payment.id}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Status">
                    <span className={adminUi.badge}>{statusLabel(booking.status)}</span>
                    {booking.cancellation ? <div className="t-caption">Cancelled</div> : null}
                    {booking.refunds.length ? <div className="t-caption">{booking.refunds.length} refund(s)</div> : null}
                  </td>
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
