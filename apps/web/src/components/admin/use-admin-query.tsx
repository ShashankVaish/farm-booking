'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/errors';
import type { Paginated } from '@/lib/properties/types';

export function useAdminQuery<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    loader()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this screen.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function QueryGate({
  loading,
  error,
  onRetry,
  label,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  label: string;
  children: ReactNode;
}) {
  if (loading) return <Spinner label={label} />;
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  return <>{children}</>;
}

export type PageMeta = Paginated<unknown>['meta'];
