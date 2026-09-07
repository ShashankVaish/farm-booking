'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdminPager, AdminTable, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, formatInr, statusLabel } from '@/lib/admin/format';
import type { AdminList, AdminRefund } from '@/lib/admin/types';

export default function AdminRefundsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminRefund>>(
    () => adminApi.refunds({ page, limit: 20 }),
    [page],
  );

  return (
    <div>
      <p className="t-label">Money</p>
      <h1 className="t-h2">Refunds</h1>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading refunds">
        <AdminTable isEmpty={!data?.items.length} emptyTitle="No refunds" emptyDescription="Refund requests will appear here.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Refund ID</th>
                <th>Booking</th>
                <th>Payment ID</th>
                <th>Gateway refund</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((refund) => (
                <tr key={refund.id}>
                  <td className={adminUi.mono}>{refund.id}</td>
                  <td>
                    <Link href={`/admin/bookings/${refund.bookingId}`}>{refund.bookingId}</Link>
                  </td>
                  <td className={adminUi.mono}>{refund.paymentId}</td>
                  <td className={adminUi.mono}>{refund.gatewayRefundId ?? '—'}</td>
                  <td>{formatInr(refund.amount)}</td>
                  <td>
                    <span className={adminUi.badge}>{statusLabel(refund.status)}</span>
                    <div className="t-caption">{formatDateTime(refund.createdAt)}</div>
                    <div className="t-caption">{refund.reason}</div>
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
