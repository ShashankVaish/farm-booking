'use client';

import { type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import type { Paginated } from '@/lib/properties/types';
import styles from './admin-ui.module.css';

export function AdminPager({
  meta,
  onPage,
}: {
  meta?: Paginated<unknown>['meta'];
  onPage: (page: number) => void;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className={styles.pager}>
      <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Previous
      </Button>
      <span className="t-caption">
        Page {meta.page} of {meta.totalPages} · {meta.total} records
      </span>
      <Button
        size="sm"
        variant="secondary"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPage(meta.page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export function AdminTable({
  children,
  emptyTitle,
  emptyDescription,
  isEmpty,
}: {
  children: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <div className={styles.scroll}>{children}</div>;
}

export function FilterForm({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  function handle(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form className={styles.filters} onSubmit={handle}>
      {children}
      <div className={styles.filterActions}>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </form>
  );
}

export { styles as adminUi };
