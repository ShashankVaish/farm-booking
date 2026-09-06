'use client';

import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import styles from './ui.module.css';

type OverlayProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: OverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title" className="t-h3">
          {title}
        </h2>
        <div style={{ marginTop: '1rem' }}>{children}</div>
        <div style={{ marginTop: '1.25rem' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Drawer({ open, title, onClose, children }: OverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="drawer-title" className="t-h3">
          {title}
        </h2>
        <div style={{ marginTop: '1rem' }}>{children}</div>
        <div style={{ marginTop: '1.25rem' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </div>
  );
}
