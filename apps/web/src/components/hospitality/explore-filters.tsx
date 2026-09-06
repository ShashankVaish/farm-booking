'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select } from '@/components/ui/forms';
import { Drawer } from '@/components/ui/overlays';
import { StaySearch } from '@/components/hospitality/stay-search';
import { toQueryString } from '@/lib/api/query';
import type { ApiAmenity } from '@/lib/properties/types';
import styles from './hospitality.module.css';

export type ExploreQuery = {
  location?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  pool?: string;
  lawn?: string;
  parking?: string;
  ac?: string;
  wifi?: string;
  kitchen?: string;
  bbq?: string;
  music?: string;
  pets?: string;
  partyAllowed?: string;
  minRating?: string;
  sort?: string;
  propertyType?: string;
  amenities?: string;
};

const AMENITY_FILTERS = [
  { key: 'pool', label: 'Pool', match: /pool|swim/i },
  { key: 'lawn', label: 'Lawn', match: /lawn|garden/i },
  { key: 'parking', label: 'Parking', match: /park/i },
  { key: 'ac', label: 'AC', match: /ac|air.?cond/i },
  { key: 'wifi', label: 'WiFi', match: /wifi|wi-fi|internet/i },
  { key: 'kitchen', label: 'Kitchen', match: /kitchen/i },
  { key: 'bbq', label: 'BBQ', match: /bbq|barbecue|barbeq/i },
  { key: 'music', label: 'Music', match: /music|dj|sound/i },
  { key: 'pets', label: 'Pets', match: /pet/i },
];

export function ExploreFilters({
  query,
  amenities,
}: {
  query: ExploreQuery;
  amenities: ApiAmenity[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(query);

  const selectedAmenityIds = useMemo(() => new Set((query.amenities ?? '').split(',').filter(Boolean)), [query.amenities]);

  function apply(next: ExploreQuery) {
    const amenityIds = AMENITY_FILTERS.filter((filter) => next[filter.key as keyof ExploreQuery] === 'true')
      .flatMap((filter) => amenities.filter((item) => filter.match.test(`${item.name} ${item.slug}`)).map((item) => item.id))
      .filter((id): id is string => Boolean(id));

    router.push(
      `/explore${toQueryString({
        location: next.location,
        city: next.city,
        checkIn: next.checkIn,
        checkOut: next.checkOut,
        guests: next.guests,
        minPrice: next.minPrice,
        maxPrice: next.maxPrice,
        bedrooms: next.bedrooms,
        bathrooms: next.bathrooms,
        pool: next.pool === 'true' ? true : undefined,
        partyAllowed: next.partyAllowed === 'true' ? true : undefined,
        minRating: next.minRating,
        sort: next.sort,
        propertyType: next.propertyType,
        amenities: amenityIds.length ? amenityIds.join(',') : undefined,
      })}`,
    );
    setOpen(false);
  }

  return (
    <div>
      <StaySearch
        defaults={{
          location: query.location ?? query.city,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
          guests: query.guests,
        }}
      />
      <div className={styles.filterBar}>
        <Select
          id="sort"
          label="Sort"
          value={query.sort ?? 'recommended'}
          onChange={(event) => apply({ ...query, sort: event.target.value })}
        >
          <option value="recommended">Recommended</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
          <option value="newest">Newest</option>
        </Select>
        <Button variant="secondary" type="button" onClick={() => setOpen(true)}>
          Filters
        </Button>
      </div>
      <Drawer open={open} title="Filters" onClose={() => setOpen(false)}>
        <Input
          id="min-price"
          label="Min price"
          type="number"
          value={draft.minPrice ?? ''}
          onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
        />
        <Input
          id="max-price"
          label="Max price"
          type="number"
          value={draft.maxPrice ?? ''}
          onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
        />
        <Input
          id="bedrooms"
          label="Bedrooms"
          type="number"
          min={1}
          value={draft.bedrooms ?? ''}
          onChange={(e) => setDraft({ ...draft, bedrooms: e.target.value })}
        />
        <Input
          id="bathrooms"
          label="Bathrooms"
          type="number"
          min={1}
          value={draft.bathrooms ?? ''}
          onChange={(e) => setDraft({ ...draft, bathrooms: e.target.value })}
        />
        <Checkbox
          id="party"
          label="Party allowed"
          checked={draft.partyAllowed === 'true'}
          onChange={(e) => setDraft({ ...draft, partyAllowed: e.target.checked ? 'true' : undefined })}
        />
        {AMENITY_FILTERS.map((filter) => (
          <Checkbox
            key={filter.key}
            id={`amenity-${filter.key}`}
            label={filter.label}
            checked={
              filter.key === 'pool'
                ? draft.pool === 'true'
                : amenities.some(
                    (item) =>
                      selectedAmenityIds.has(item.id ?? '') && filter.match.test(`${item.name} ${item.slug}`),
                  ) || draft[filter.key as keyof ExploreQuery] === 'true'
            }
            onChange={(e) =>
              setDraft({
                ...draft,
                [filter.key]: e.target.checked ? 'true' : undefined,
              })
            }
          />
        ))}
        <div style={{ marginTop: '1rem' }}>
          <Button type="button" onClick={() => apply(draft)}>
            Show stays
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
