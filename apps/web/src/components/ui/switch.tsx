'use client';

import { useState } from 'react';
import styles from './ui.module.css';

type SwitchProps = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({ label, checked, defaultChecked, disabled, onCheckedChange }: SwitchProps) {
  const [uncontrolled, setUncontrolled] = useState(Boolean(defaultChecked));
  const isOn = checked ?? uncontrolled;

  return (
    <label className={styles.checkRow}>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={isOn}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          const next = !isOn;
          if (checked === undefined) {
            setUncontrolled(next);
          }
          onCheckedChange?.(next);
        }}
      >
        <span className={styles.thumb} />
      </button>
      <span className="t-body-small">{label}</span>
    </label>
  );
}
