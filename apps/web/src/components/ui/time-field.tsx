'use client';

import { useMemo } from 'react';
import { Select } from '@/components/ui/forms';
import { snapToStep, TIME_STEP_MINUTES, timeOptions } from '@/lib/time/clock';
import styles from './time-field.module.css';

/*
  A time picker built on the existing Select rather than `<input type="time">`.

  The native control was the previous approach and it is inconsistent in exactly
  the place this is used: its clock affordance is browser-drawn — Chrome tints it
  from `color-scheme`, Firefox draws nothing — so on the dark theme a host often
  saw a bare box with no sign it held a time. A select also pins the value to a
  real check-in time instead of letting someone save 14:07, shows 12-hour labels
  a host does not have to convert in their head, and gets the platform wheel
  picker for free on a phone.
*/
export function TimeField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  stepMinutes = TIME_STEP_MINUTES,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  stepMinutes?: number;
}) {
  const options = useMemo(() => timeOptions(stepMinutes), [stepMinutes]);
  // A stored value off the grid would otherwise select nothing and silently
  // save as midnight the next time the form is submitted.
  const selected = useMemo(() => snapToStep(value, stepMinutes), [value, stepMinutes]);
  const isKnown = options.some((option) => option.value === selected);

  return (
    <Select
      id={id}
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      className={styles.control}
      value={isKnown ? selected : ''}
      onChange={(event) => onChange(event.target.value)}
    >
      {isKnown ? null : (
        <option value="" disabled>
          Choose a time
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
