'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminPager, AdminTable, FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime } from '@/lib/admin/format';
import type { AdminList, AdminReview } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

export default function AdminReviewsPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ q: '' });
  const [applied, setApplied] = useState(draft);
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useAdminQuery<AdminList<AdminReview>>(
    () => adminApi.reviews({ page, limit: 20, q: applied.q }),
    [page, applied],
  );

  async function moderate() {
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.moderateReview(target.id, !target.isPublished);
      notify('Review moderation saved. This is audited.');
      setTarget(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not moderate review.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Trust</p>
      <h1 className="t-h2">Reviews</h1>
      <FilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(draft);
        }}
      >
        <Input id="rev-q" label="Search" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading reviews">
        <AdminTable isEmpty={!data?.items.length} emptyTitle="No reviews" emptyDescription="Guest reviews will appear here.">
          <table className={adminUi.table}>
            <thead>
              <tr>
                <th>Property</th>
                <th>Guest</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Visibility</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((review) => (
                <tr key={review.id}>
                  <td>{review.property?.title}</td>
                  <td>{review.customer?.name}</td>
                  <td>{review.rating}</td>
                  <td>{review.comment}</td>
                  <td>
                    <span className={adminUi.badge}>{review.isPublished ? 'Published' : 'Hidden'}</span>
                    <div className="t-caption">{formatDateTime(review.createdAt)}</div>
                  </td>
                  <td>
                    <Button size="sm" variant={review.isPublished ? 'danger' : 'secondary'} onClick={() => setTarget(review)}>
                      {review.isPublished ? 'Unpublish' : 'Publish'}
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
        open={Boolean(target)}
        title={target?.isPublished ? 'Hide this review?' : 'Publish this review?'}
        description="Moderation is enforced on the server and written to the audit log."
        confirmLabel={target?.isPublished ? 'Unpublish' : 'Publish'}
        danger={target?.isPublished}
        busy={busy}
        onClose={() => setTarget(null)}
        onConfirm={() => void moderate()}
      />
    </div>
  );
}
