'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/forms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { AvailabilityCalendar } from '@/components/host/availability-calendar';
import { hostApi, type OwnerProperty } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';

export default function HostCalendarPage() {
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hostApi
      .properties()
      .then((result) => {
        setProperties(result.items);
        setSelected(result.items[0]?.id ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load calendars.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading calendar" />;
  if (error) return <ErrorState description={error} />;
  if (properties.length === 0) {
    return (
      <EmptyState
        title="No listings"
        description="Create a property before blocking dates."
        actionHref="/host/properties/new"
        actionLabel="New listing"
      />
    );
  }

  const active = properties.find((property) => property.id === selected);

  return (
    <div>
      <p className="t-label">Availability</p>
      <h1 className="t-h2">Calendar</h1>
      <p className="t-body-small" style={{ marginTop: 'var(--space-2)', maxWidth: '44rem' }}>
        Select dates to close them off for maintenance or personal use. Click a date to pick it,
        or hold <kbd>Shift</kbd> to take a whole range. Booked nights are locked — cancel the
        booking first if you need those dates back.
      </p>

      <div style={{ maxWidth: '26rem', margin: 'var(--space-6) 0 var(--space-5)' }}>
        <Select
          id="cal-property"
          label="Property"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          hint={active?.status && active.status !== 'APPROVED' ? `This listing is ${active.status.toLowerCase().replace(/_/g, ' ')} — blocked dates still apply once it goes live.` : undefined}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </Select>
      </div>

      {selected ? <AvailabilityCalendar propertyId={selected} /> : null}
    </div>
  );
}
