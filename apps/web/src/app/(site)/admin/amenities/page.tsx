'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AdminTable, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import type { AdminAmenity } from '@/lib/admin/types';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';

export default function AdminAmenitiesPage() {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAdminQuery<AdminAmenity[]>(() => adminApi.amenities(), []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminAmenity | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await adminApi.createAmenity({ name });
      notify('Amenity created. This is audited.');
      setName('');
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create amenity.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await adminApi.updateAmenity(editing.id, { name: editing.name });
      notify('Amenity updated. This is audited.');
      setEditing(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update amenity.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteId) return;
    setBusy(true);
    try {
      await adminApi.deleteAmenity(deleteId);
      notify('Amenity deleted. This is audited.');
      setDeleteId(null);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete amenity.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Catalog</p>
      <h1 className="t-h2">Amenities</h1>
      <form className={adminUi.panel} onSubmit={(event) => void create(event)} style={{ maxWidth: '28rem' }}>
        <Input id="amenity-name" label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={busy}>
          Add amenity
        </Button>
      </form>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <QueryGate loading={loading} error={error} onRetry={reload} label="Loading amenities">
          <AdminTable isEmpty={!data?.length} emptyTitle="No amenities" emptyDescription="Add pool, lawn, or barbecue.">
            <table className={adminUi.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.map((amenity) => (
                  <tr key={amenity.id}>
                    <td>
                      {editing?.id === amenity.id ? (
                        <Input
                          id={`edit-${amenity.id}`}
                          label="Name"
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        />
                      ) : (
                        amenity.name
                      )}
                    </td>
                    <td className={adminUi.mono}>{amenity.slug}</td>
                    <td>
                      <div className={adminUi.actions}>
                        {editing?.id === amenity.id ? (
                          <>
                            <Button size="sm" onClick={() => void saveEdit()} disabled={busy}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => setEditing(amenity)}>
                              Rename
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => setDeleteId(amenity.id)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        </QueryGate>
      </div>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this amenity?"
        description="Listings that already use it may fail to save until they are updated. This is audited."
        confirmLabel="Delete amenity"
        danger
        busy={busy}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
