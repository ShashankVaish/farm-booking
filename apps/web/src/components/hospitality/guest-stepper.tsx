'use client';

import { useEffect, useState } from 'react';
import styles from './guest-stepper.module.css';

/**
 * Parses what the guest typed. Empty stays empty (so the box can be cleared
 * and retyped); anything else is clamped to 1..max.
 */
export function parseGuests(raw: string, max: number): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return Math.min(max, Math.max(1, Number(digits)));
}

/*
  Guests as − [ n ] +, Airbnb-style.

  The box used to clamp on every keystroke: clearing "2" made it "1" at once,
  so typing 7 gave "17", which the cap turned into 15. Now the typed text is
  kept as-is while typing and only settled (clamped, or restored when left
  empty) when the box loses focus — while every valid number is still passed
  up straight away so the price follows as the guest types.
*/
export function GuestStepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Follow changes made elsewhere (the − / + buttons) unless mid-typing.
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  function commit(next: number) {
    setText(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <div className={styles.field}>
      <label htmlFor="book-guests" className={styles.label}>
        Guests
      </label>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.step}
          onClick={() => commit(Math.max(1, value - 1))}
          disabled={disabled || value <= 1}
          aria-label="Fewer guests"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <input
          id="book-guests"
          className={styles.input}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={text}
          disabled={disabled}
          aria-describedby="book-guests-max"
          onFocus={(event) => {
            setFocused(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, '').slice(0, 3);
            setText(raw);
            const parsed = parseGuests(raw, max);
            if (parsed !== null && parsed !== value) onChange(parsed);
          }}
          onBlur={() => {
            setFocused(false);
            commit(parseGuests(text, max) ?? value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className={styles.step}
          onClick={() => commit(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          aria-label="More guests"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p id="book-guests-max" className={styles.hint}>
        Up to {max} guests
      </p>
    </div>
  );
}
