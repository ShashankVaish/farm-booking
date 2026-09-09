'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/forms';
import styles from '@/components/ui/ui.module.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  busy?: boolean;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  reasonRequired,
  reasonLabel = 'Reason',
  busy,
  children,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const reasonOk = !reasonRequired || reason.trim().length >= 8;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="t-h3">
          {title}
        </h2>
        <p className="t-body-small" style={{ marginTop: 'var(--space-3)' }}>
          {description}
        </p>
        {children ? <div style={{ marginTop: 'var(--space-4)' }}>{children}</div> : null}
        {reasonRequired ? (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Textarea
              id="confirm-reason"
              label={reasonLabel}
              required
              minLength={8}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="At least 8 characters. This is stored in the audit log."
            />
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={busy || !reasonOk}
            onClick={() => onConfirm(reasonRequired ? reason.trim() : undefined)}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
