'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/forms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type OwnerProperty } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import { AvailabilityEditor } from '../listing-wizard';

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

  return (
    <div>
      <p className="t-label">Availability</p>
      <h1 className="t-h2">Calendar</h1>
      <Select id="cal-property" label="Property" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.title}
          </option>
        ))}
      </Select>
      {selected ? <AvailabilityEditor propertyId={selected} /> : null}
    </div>
  );
}
