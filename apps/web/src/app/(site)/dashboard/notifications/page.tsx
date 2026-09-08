'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/forms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/components/providers/toast-provider';
import type { Paginated } from '@/lib/properties/types';
import styles from '../dashboard.module.css';

type AccountNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationPrefs = {
  bookingConfirmation: boolean;
  paymentSuccess: boolean;
  paymentFailure: boolean;
  cancellation: boolean;
  refund: boolean;
  propertyApproval: boolean;
  propertyRejection: boolean;
  newReview: boolean;
  coupon: boolean;
};

const PREF_FIELDS: Array<{ key: keyof NotificationPrefs; label: string }> = [
  { key: 'bookingConfirmation', label: 'Booking confirmation' },
  { key: 'paymentSuccess', label: 'Payment success' },
  { key: 'paymentFailure', label: 'Payment failure' },
  { key: 'cancellation', label: 'Cancellation' },
  { key: 'refund', label: 'Refund' },
  { key: 'propertyApproval', label: 'Property approval' },
  { key: 'propertyRejection', label: 'Property rejection' },
  { key: 'newReview', label: 'New review' },
  { key: 'coupon', label: 'Coupon' },
];

export default function NotificationsPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      apiClient.get<Paginated<AccountNotification>>(`/api/notifications${toQueryString({ page: 1, limit: 50 })}`),
      apiClient.get<NotificationPrefs>('/api/notifications/preferences'),
    ])
      .then(([list, preferences]) => {
        setItems(list.items);
        setPrefs(preferences);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load notifications.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function savePrefs(next: NotificationPrefs) {
    setPrefs(next);
    try {
      const saved = await apiClient.patch<NotificationPrefs>('/api/notifications/preferences', next);
      setPrefs(saved);
      notify('Notification preferences saved.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save preferences.', 'error');
      load();
    }
  }

  if (loading) return <Spinner label="Loading notifications" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Notifications</h1>
      {prefs ? (
        <section className={styles.panel} style={{ marginBottom: 'var(--space-8)', maxWidth: '36rem' }}>
          <h2 className="t-h3">Preferences</h2>
          <p className="t-caption">Choose which events create an in-app notice. Delivery still happens on the server.</p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            {PREF_FIELDS.map((field) => (
              <Checkbox
                key={field.key}
                id={`pref-${field.key}`}
                label={field.label}
                checked={prefs[field.key]}
                onChange={(event) => {
                  void savePrefs({ ...prefs, [field.key]: event.target.checked });
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="You are all caught up" description="Booking and payment updates will appear here." />
      ) : (
        <ul className={styles.list}>
          {items.map((note) => (
            <li key={note.id} className={styles.row}>
              <div>
                <p className="t-body">{note.title}</p>
                <p className="t-caption">{note.body}</p>
              </div>
              {!note.readAt ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void apiClient.post(`/api/notifications/${note.id}/read`).then(() => load());
                  }}
                >
                  Mark read
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
