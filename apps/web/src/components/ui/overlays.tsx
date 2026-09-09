'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import styles from './ui.module.css';

type OverlayProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  id?: string;
};

function useBodyLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function Modal({ open, title, onClose, children }: OverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useBodyLock(open);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.overlayHead}>
          <h2 id={titleId} className="t-h3">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            Close
          </Button>
        </div>
        <div style={{ marginTop: '1rem' }}>{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, title, onClose, children, id }: OverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useEscape(open, onClose);
  useBodyLock(open);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <aside
        ref={panelRef}
        id={id}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.overlayHead}>
          <h2 id={titleId} className="t-h3">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close filters">
            Close
          </Button>
        </div>
        <div style={{ marginTop: '1rem' }}>{children}</div>
      </aside>
    </div>
  );
}
