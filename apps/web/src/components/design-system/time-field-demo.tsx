'use client';

import { useState } from 'react';
import { TimeField } from '@/components/ui/time-field';
import { formatSlotRange } from '@/lib/time/clock';

/** Two linked time fields, the way the listing wizard uses them for a slot. */
export function TimeFieldDemo() {
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('06:00');

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)', maxWidth: '28rem' }}>
      <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr' }}>
        <TimeField id="demo-start" label="Starts" value={start} onChange={setStart} />
        <TimeField id="demo-end" label="Ends" value={end} onChange={setEnd} />
      </div>
      {/* Reads back the span so an overnight range is obviously right. */}
      <p className="t-body-small">{formatSlotRange(start, end)}</p>
    </div>
  );
}
