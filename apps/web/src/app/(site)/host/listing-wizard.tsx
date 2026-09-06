'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AmenityItem, PriceDisplay, Rating } from '@/components/hospitality/atoms';
import { ImageGalleryFoundation } from '@/components/hospitality/foundations';
import { PropertyCard } from '@/components/hospitality/property-card';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/forms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/errors';
import { hostApi, type AmenityRecord } from '@/lib/host/host-api';
import { validateListingLocation } from '@/lib/host/listing-location';
import { fromApiProperty, toPropertyPayload } from '@/lib/host/listing-payload';
import { emptyListing, WIZARD_STEPS, type ListingDraft } from '@/lib/host/listing-types';
import { uploadMedia, resolveMedia } from '@/lib/media/provider';
import { validateListingImage } from '@/lib/media/upload';
import { toPropertyCard } from '@/lib/properties/map-property';
import { PROPERTY_TYPE_LABEL, type ApiProperty } from '@/lib/properties/types';
import { useToast } from '@/components/providers/toast-provider';
import { cn } from '@/lib/cn';
import { LocationStep } from './location-step';
import styles from './host.module.css';

const EXTRA_AMENITIES = [
  { slug: 'music', label: 'Music system' },
  { slug: 'bbq', label: 'BBQ' },
  { slug: 'party-allowed', label: 'Party allowed' },
];

const MAX_PHOTOS = 20;
const MIN_PHOTOS = 1;

function draftAsProperty(draft: ListingDraft): ApiProperty {
  return {
    id: draft.id || 'preview',
    status: draft.status,
    title: draft.title || 'Untitled stay',
    description: draft.description,
    propertyType: draft.propertyType,
    location: draft.location.location || draft.location.city,
    city: draft.location.city,
    state: draft.location.state,
    country: draft.location.country,
    address: draft.location.confirmed ? draft.location.city : `${draft.location.city} area`,
    pincode: draft.location.pincode,
    latitude: draft.location.latitude ?? undefined,
    longitude: draft.location.longitude ?? undefined,
    guestCapacity: draft.guestCapacity,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    basePrice: draft.weekdayPrice,
    weekendPrice: draft.weekendPrice,
    extraGuestCharge: draft.extraGuestCharge,
    partyRules: draft.partyRules,
    propertyRules: draft.houseRules,
    cancellationPolicy: draft.cancellationPolicy,
    isPartyFriendly: draft.isPartyFriendly,
    images: draft.images.map((image, index) => ({
      url: image.url,
      altText: image.alt,
      isCover: image.isCover,
      sortOrder: index,
    })),
  };
}

export function ListingWizard({ propertyId }: { propertyId?: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ListingDraft>(emptyListing);
  const [amenities, setAmenities] = useState<AmenityRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    hostApi.amenities().then(setAmenities).catch(() => setAmenities([]));
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    hostApi
      .getProperty(propertyId)
      .then((property) => setDraft(fromApiProperty(property)))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'This listing could not be loaded.'))
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function persist(next = draft): Promise<ListingDraft> {
    const payload = toPropertyPayload(next);
    const saved = next.id
      ? await hostApi.updateProperty(next.id, payload)
      : await hostApi.createProperty(payload);
    const mapped = fromApiProperty(saved);
    setDraft(mapped);
    if (!next.id && saved.id) {
      router.replace(`/host/properties/${saved.id}/edit`);
    }
    return mapped;
  }

  async function goNext() {
    const currentErrors = validateStep(step, draft);
    if (Object.keys(currentErrors).length > 0) {
      setError(Object.values(currentErrors)[0]);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (step >= 2 && (draft.location.confirmed || draft.id)) {
        await persist();
      }
      setStep((value) => Math.min(value + 1, WIZARD_STEPS.length - 1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this listing.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      await persist();
      notify('Draft saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this listing.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const all = [0, 1, 2, 4, 5, 9].flatMap((index) => Object.values(validateStep(index, draft)));
    if (all.length > 0) {
      setError(all[0]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await persist();
      await hostApi.updateProperty(saved.id as string, { status: 'PENDING_APPROVAL' });
      notify('Submitted for review. You cannot approve your own listing.');
      router.push('/host/properties');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit this listing.');
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | File[]) {
    setPhotoError(null);
    const list = Array.from(files);
    if (draft.images.length + list.length > MAX_PHOTOS) {
      setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    for (const file of list) {
      const invalid = validateListingImage(file);
      if (invalid) {
        setPhotoError(invalid);
        continue;
      }
      try {
        setProgress(0);
        const uploaded = await uploadMedia(file, setProgress);
        setDraft((current) => ({
          ...current,
          images: [
            ...current.images,
            {
              url: uploaded.url,
              publicId: uploaded.publicId,
              alt: uploaded.alt || file.name,
              isCover: current.images.length === 0,
            },
          ],
        }));
      } catch (err) {
        setPhotoError(err instanceof ApiError ? err.message : 'Upload failed.');
      } finally {
        setProgress(null);
      }
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const images = [...current.images];
      const next = index + direction;
      if (next < 0 || next >= images.length) return current;
      const [item] = images.splice(index, 1);
      images.splice(next, 0, item);
      return { ...current, images };
    });
  }

  if (loading) {
    return <Spinner label="Loading listing" />;
  }

  if (error && !draft.title && propertyId) {
    return <ErrorState description={error} />;
  }

  const preview = draftAsProperty(draft);
  const card = toPropertyCard(preview);
  card.href = '#preview';

  return (
    <div>
      <p className="t-label">Listing wizard</p>
      <h1 className="t-h2">{draft.id ? 'Edit listing' : 'New listing'}</h1>
      <div className={styles.steps} role="tablist" aria-label="Listing steps">
        {WIZARD_STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={cn(styles.step, index === step && styles.stepCurrent)}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <div className={styles.panel}>
          <Input id="title" label="Property name" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Select
            id="type"
            label="Property type"
            value={draft.propertyType}
            onChange={(e) => setDraft({ ...draft, propertyType: e.target.value as ListingDraft['propertyType'] })}
          >
            {Object.entries(PROPERTY_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Textarea
            id="description"
            label="Description"
            required
            rows={8}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            hint="Tell guests about the lawn, pool, and how the stay feels."
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className={styles.panel}>
          <LocationStep value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className={`${styles.panel} ${styles.twoCol}`}>
          <Input id="guests" label="Guests" type="number" min={1} value={draft.guestCapacity} onChange={(e) => setDraft({ ...draft, guestCapacity: Number(e.target.value) })} />
          <Input id="bedrooms" label="Bedrooms" type="number" min={1} value={draft.bedrooms} onChange={(e) => setDraft({ ...draft, bedrooms: Number(e.target.value) })} />
          <Input id="bathrooms" label="Bathrooms" type="number" min={1} value={draft.bathrooms} onChange={(e) => setDraft({ ...draft, bathrooms: Number(e.target.value) })} />
          <Input id="beds" label="Beds" type="number" min={1} value={draft.meta.beds} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, beds: Number(e.target.value) } })} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className={styles.panel}>
          <div className={styles.amenityGrid}>
            {amenities.map((amenity) => (
              <Checkbox
                key={amenity.id}
                id={`amenity-${amenity.id}`}
                label={amenity.name}
                checked={draft.amenityIds.includes(amenity.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    amenityIds: e.target.checked
                      ? [...draft.amenityIds, amenity.id]
                      : draft.amenityIds.filter((id) => id !== amenity.id),
                    isPartyFriendly: amenity.slug.includes('party') ? e.target.checked || draft.isPartyFriendly : draft.isPartyFriendly,
                  })
                }
              />
            ))}
            {EXTRA_AMENITIES.map((extra) => (
              <Checkbox
                key={extra.slug}
                id={`extra-${extra.slug}`}
                label={extra.label}
                checked={draft.meta.extras.includes(extra.slug) || (extra.slug === 'party-allowed' && draft.isPartyFriendly)}
                onChange={(e) => {
                  const extras = e.target.checked
                    ? [...draft.meta.extras.filter((item) => item !== extra.slug), extra.slug]
                    : draft.meta.extras.filter((item) => item !== extra.slug);
                  setDraft({
                    ...draft,
                    isPartyFriendly: extra.slug === 'party-allowed' ? e.target.checked : draft.isPartyFriendly,
                    meta: { ...draft.meta, extras },
                  });
                }}
              />
            ))}
          </div>
          {amenities.length === 0 ? (
            <p className="t-body-small">Amenity catalog is empty. Extra tags above are still saved with the listing.</p>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className={styles.panel}>
          <div
            className={styles.dropzone}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void onFiles(event.dataTransfer.files);
            }}
          >
            <p className="t-body">Drag photos here or choose files</p>
            <p className="t-caption">JPEG, PNG, or WebP · up to 8 MB · {MIN_PHOTOS}–{MAX_PHOTOS} images</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                if (event.target.files) void onFiles(event.target.files);
              }}
              style={{ marginTop: 'var(--space-4)' }}
            />
          </div>
          {progress !== null ? (
            <div className={styles.progress} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          {photoError ? (
            <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
              {photoError}
            </p>
          ) : null}
          <div className={styles.photos}>
            {draft.images.map((image, index) => (
              <div key={`${image.url}-${index}`} className={styles.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveMedia({ src: image.url, alt: image.alt }).src} alt={image.alt} />
                <div className={styles.photoBar}>
                  <Button size="sm" variant={image.isCover ? 'primary' : 'ghost'} onClick={() => setDraft({ ...draft, images: draft.images.map((item, i) => ({ ...item, isCover: i === index })) })}>
                    Cover
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => movePhoto(index, -1)}>
                    Up
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => movePhoto(index, 1)}>
                    Down
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        images: draft.images.filter((_, i) => i !== index).map((item, i) => ({ ...item, isCover: i === 0 || item.isCover })),
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className={`${styles.panel} ${styles.twoCol}`}>
          <Input id="weekday" label="Weekday price (₹)" type="number" min={0} value={draft.weekdayPrice} onChange={(e) => setDraft({ ...draft, weekdayPrice: Number(e.target.value) })} />
          <Input id="weekend" label="Weekend price (₹)" type="number" min={0} value={draft.weekendPrice} onChange={(e) => setDraft({ ...draft, weekendPrice: Number(e.target.value) })} />
          <Input id="extra" label="Extra guest charge (₹)" type="number" min={0} value={draft.extraGuestCharge} onChange={(e) => setDraft({ ...draft, extraGuestCharge: Number(e.target.value) })} />
          <Input id="minstay" label="Minimum stay (nights)" type="number" min={1} value={draft.meta.minStay} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, minStay: Number(e.target.value) } })} />
          <Textarea
            id="seasonal"
            label="Seasonal pricing (optional)"
            rows={4}
            value={draft.meta.seasonal}
            onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, seasonal: e.target.value } })}
            hint="Example: Diwali week ₹18,000 / night"
          />
        </div>
      ) : null}

      {step === 6 ? (
        <div className={styles.panel}>
          <div className={styles.twoCol}>
            <Input id="checkin" label="Check-in time" type="time" value={draft.meta.checkIn} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, checkIn: e.target.value } })} />
            <Input id="checkout" label="Check-out time" type="time" value={draft.meta.checkOut} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, checkOut: e.target.value } })} />
          </div>
          <Textarea id="cancel" label="Cancellation policy" rows={4} value={draft.cancellationPolicy} onChange={(e) => setDraft({ ...draft, cancellationPolicy: e.target.value })} />
          <Textarea id="party" label="Party rules" rows={4} value={draft.partyRules} onChange={(e) => setDraft({ ...draft, partyRules: e.target.value })} />
          <Input id="smoking" label="Smoking" value={draft.meta.smoking} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, smoking: e.target.value } })} />
          <Input id="pets" label="Pets" value={draft.meta.pets} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, pets: e.target.value } })} />
          <Input id="noise" label="Noise rules" value={draft.meta.noise} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, noise: e.target.value } })} />
          <Textarea id="house" label="House rules" rows={5} value={draft.houseRules} onChange={(e) => setDraft({ ...draft, houseRules: e.target.value })} />
          <Checkbox id="party-flag" label="This stay is party-friendly" checked={draft.isPartyFriendly} onChange={(e) => setDraft({ ...draft, isPartyFriendly: e.target.checked })} />
        </div>
      ) : null}

      {step === 7 ? <AvailabilityEditor propertyId={draft.id} /> : null}

      {step === 8 ? (
        <div>
          <p className="t-body-small">This is how guests will see the stay once it is approved. Exact map pin is shown only after you confirm it; public pages can later use an approximate area.</p>
          <div style={{ maxWidth: '24rem', margin: 'var(--space-5) 0' }}>
            <PropertyCard property={card} />
          </div>
          <div className={styles.panel}>
            <h2 className="t-h2">{draft.title}</h2>
            <p className="t-body-small">
              {draft.location.city}, {draft.location.state}
            </p>
            <Rating value={0} count={0} />
            <ImageGalleryFoundation
              images={
                draft.images.length
                  ? draft.images.map((image) => ({ asset: { src: image.url, alt: image.alt }, alt: image.alt }))
                  : [{ alt: draft.title, tone: 'lawn' as const }]
              }
            />
            <p className="t-body" style={{ marginTop: 'var(--space-5)' }}>
              {draft.description}
            </p>
            <p className="t-body-small">
              {draft.guestCapacity} guests · {draft.bedrooms} bedrooms · {draft.bathrooms} bathrooms · {draft.meta.beds} beds
            </p>
            <div className={styles.amenityGrid} style={{ marginTop: 'var(--space-4)' }}>
              {amenities
                .filter((amenity) => draft.amenityIds.includes(amenity.id))
                .map((amenity) => (
                  <AmenityItem key={amenity.id} label={amenity.name} />
                ))}
            </div>
            <PriceDisplay amount={draft.weekdayPrice} prefix="From" />
            <p className="t-caption">Weekend ₹{draft.weekendPrice || draft.weekdayPrice}</p>
          </div>
        </div>
      ) : null}

      {step === 9 ? (
        <div className={styles.panel}>
          <h2 className="t-h3">Submit for approval</h2>
          <p className="t-body">
            Reviewers will check photos, location, and house rules. Owners cannot approve their own property or change guest booking statuses from this portal.
          </p>
          <p className="t-body-small">Current status: {draft.status || 'DRAFT'}</p>
          <Button onClick={() => void submit()} disabled={busy || draft.status === 'PENDING_APPROVAL'}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
          Back
        </Button>
        {step < 9 ? (
          <Button onClick={() => void goNext()} disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => void saveDraft()} disabled={busy || !draft.location.confirmed}>
          Save draft
        </Button>
      </div>
    </div>
  );
}

function validateStep(step: number, draft: ListingDraft): Record<string, string> {
  if (step === 0) {
    const errors: Record<string, string> = {};
    if (draft.title.trim().length < 3) errors.title = 'Name must be at least 3 characters.';
    if (draft.description.trim().length < 20) errors.description = 'Description must be at least 20 characters.';
    return errors;
  }
  if (step === 1) return validateListingLocation(draft.location);
  if (step === 2) {
    const errors: Record<string, string> = {};
    if (draft.guestCapacity < 1) errors.guests = 'Enter guest capacity.';
    if (draft.bedrooms < 1) errors.bedrooms = 'Enter bedrooms.';
    if (draft.bathrooms < 1) errors.bathrooms = 'Enter bathrooms.';
    if (draft.meta.beds < 1) errors.beds = 'Enter beds.';
    return errors;
  }
  if (step === 4) {
    if (draft.images.length > MAX_PHOTOS) return { photos: `Maximum ${MAX_PHOTOS} photos.` };
    return {};
  }
  if (step === 5) {
    if (draft.weekdayPrice <= 0) return { price: 'Set a weekday price.' };
    if (draft.meta.minStay < 1) return { minStay: 'Minimum stay must be at least 1 night.' };
    return {};
  }
  if (step === 9 && draft.images.length < MIN_PHOTOS) {
    return { photos: 'Add at least one photo before submitting.' };
  }
  return {};
}

export function AvailabilityEditor({ propertyId }: { propertyId?: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Array<{ date: string; status: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    const from = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
    hostApi
      .availability(propertyId, from, to)
      .then(setDays)
      .catch(() => setDays([]));
  }, [month, propertyId]);

  if (!propertyId) {
    return <EmptyState title="Save the listing first" description="Availability can be blocked after the draft is created." />;
  }

  async function apply(kind: 'block' | 'unblock') {
    if (!propertyId) return;
    const dates = selected.filter((date) => days.find((day) => day.date === date)?.status !== 'BOOKED');
    if (dates.length === 0) return;
    setMessage(null);
    try {
      if (kind === 'block') await hostApi.blockDates(propertyId, dates);
      else await hostApi.unblockDates(propertyId, dates);
      setSelected([]);
      const from = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
      setDays(await hostApi.availability(propertyId, from, to));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not update availability.');
    }
  }

  return (
    <div className={styles.panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <p className="t-label">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        <div>
          <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            Prev
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            Next
          </Button>
        </div>
      </div>
      <p className="t-caption">Available · blocked · booked (booked dates cannot be changed)</p>
      <div className={styles.calendarGrid}>
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            disabled={day.status === 'BOOKED'}
            className={cn(
              styles.calDay,
              day.status === 'BLOCKED' && styles.calBlocked,
              day.status === 'BOOKED' && styles.calBooked,
              selected.includes(day.date) && styles.stepCurrent,
            )}
            onClick={() =>
              setSelected((current) => (current.includes(day.date) ? current.filter((item) => item !== day.date) : [...current, day.date]))
            }
          >
            {Number(day.date.slice(8, 10))}
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <Button size="sm" onClick={() => void apply('block')}>
          Block selected
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void apply('unblock')}>
          Unblock selected
        </Button>
      </div>
      {message ? <p className="t-body-small">{message}</p> : null}
    </div>
  );
}
