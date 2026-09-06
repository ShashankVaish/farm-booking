'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type HostNotification } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import styles from '../dashboard.module.css';

export default function NotificationsPage() {
  const [items, setItems] = useState<HostNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    hostApi
      .notifications()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load notifications.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading notifications" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Notifications</h1>
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
                    void hostApi.markNotificationRead(note.id).then(() => load());
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
