'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AmenityItem, PriceDisplay, Rating } from '@/components/hospitality/atoms';
import { PropertyGallery } from '@/components/hospitality/property-gallery';
import { PropertyCard } from '@/components/hospitality/property-card';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/forms';
import { TimeField } from '@/components/ui/time-field';
import { formatSlotRange } from '@/lib/time/clock';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { AvailabilityCalendar } from '@/components/host/availability-calendar';
import { ApiError } from '@/lib/api/errors';
import { hostApi, type AmenityRecord, type HostKycStatus } from '@/lib/host/host-api';
import { validateListingLocation } from '@/lib/host/listing-location';
import {
  policyOptions,
  selectedPolicy,
  PET_OPTIONS,
  SMOKING_OPTIONS,
} from '@/lib/host/listing-policies';
import { fromApiProperty, toPropertyPayload } from '@/lib/host/listing-payload';
import { emptyListing, WIZARD_STEPS, type ListingDraft } from '@/lib/host/listing-types';
import { uploadMedia, resolveMedia } from '@/lib/media/provider';
import { validateListingImage } from '@/lib/media/upload';
import { toPropertyCard } from '@/lib/properties/map-property';
import { PROPERTY_TYPE_LABEL, type ApiProperty } from '@/lib/properties/types';
import { useToast } from '@/components/providers/toast-provider';
import { cn } from '@/lib/cn';
import { LocationStep } from './location-step';
import { VerificationStep } from './verification-step';
import styles from './host.module.css';

const EXTRA_AMENITIES = [
  { slug: 'music', label: 'Music system' },
  { slug: 'bbq', label: 'BBQ' },
  { slug: 'party-allowed', label: 'Party allowed' },
];

/*
  Photos are capped but no longer required. The four-photo minimum blocked hosts
  who wanted to publish first and add photos later; a listing with none falls
  back to a styled placeholder rather than breaking.
*/
const MAX_PHOTOS = 8;

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
    isAdultOnly: draft.isAdultOnly,
    isCoupleFriendly: draft.isCoupleFriendly,
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
  const [kyc, setKyc] = useState<HostKycStatus | null>(null);

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
    // Step 6 carries the booking-slot rule, so it has to be re-checked here:
    // a host can reach Submit without ever opening it.
    const all = [0, 1, 2, 4, 5, 6, 10].flatMap((index) => Object.values(validateStep(index, draft)));
    if (all.length > 0) {
      setError(all[0]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await persist();
      if (!saved.id) {
        throw new Error('The listing was saved without an identifier. Please try again.');
      }
      if (saved.status === 'APPROVED' || saved.status === 'SUSPENDED') {
        setError('This listing cannot be submitted for review in its current status.');
        return;
      }
      if (saved.status !== 'PENDING_APPROVAL') {
        await hostApi.updateProperty(saved.id, { status: 'PENDING_APPROVAL' });
      }
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
          <Input id="guests" label="Guests" type="number" min={1} step={1} value={draft.guestCapacity} onChange={(e) => setDraft({ ...draft, guestCapacity: Math.max(0, Number(e.target.value) || 0) })} />
          <Input id="bedrooms" label="Bedrooms" type="number" min={1} step={1} value={draft.bedrooms} onChange={(e) => setDraft({ ...draft, bedrooms: Math.max(0, Number(e.target.value) || 0) })} />
          <Input id="bathrooms" label="Bathrooms" type="number" min={1} step={1} value={draft.bathrooms} onChange={(e) => setDraft({ ...draft, bathrooms: Math.max(0, Number(e.target.value) || 0) })} />
          <Input id="beds" label="Beds" type="number" min={1} step={1} value={draft.meta.beds} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, beds: Math.max(0, Number(e.target.value) || 0) } })} />
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
            <p className="t-caption">
              JPEG, PNG, or WebP · up to 25 MB each · up to {MAX_PHOTOS} photos
            </p>
            <p className="t-caption">
              {draft.images.length} of {MAX_PHOTOS} added
              {draft.images.length === 0 ? ' · a listing with photos gets far more bookings' : ''}
            </p>
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
          <Input id="weekday" label="Weekday price (₹)" type="number" inputMode="numeric" min={0} step={1} value={draft.weekdayPrice} onChange={(e) => setDraft({ ...draft, weekdayPrice: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
          <Input id="weekend" label="Weekend price (₹)" type="number" inputMode="numeric" min={0} step={1} value={draft.weekendPrice} onChange={(e) => setDraft({ ...draft, weekendPrice: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
          <Input id="extra" label="Extra guest charge (₹)" type="number" inputMode="numeric" min={0} step={1} value={draft.extraGuestCharge} onChange={(e) => setDraft({ ...draft, extraGuestCharge: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
          <Input id="minstay" label="Minimum stay (nights)" type="number" inputMode="numeric" min={1} step={1} value={draft.meta.minStay} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, minStay: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } })} />
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
          <fieldset className={styles.slotGroup}>
            <legend className="t-h4">When can this place be booked?</legend>
            <p className="t-body-small" style={{ margin: '0 0 var(--space-4)' }}>
              Pick every sitting you let this place out for. Guests see these on your listing.
            </p>

            <SlotOption
              id="slot-day"
              label="Day party"
              description="A daytime sitting that ends the same evening."
              checked={draft.meta.daySlot}
              onToggle={(daySlot) => setDraft({ ...draft, meta: { ...draft.meta, daySlot } })}
              start={draft.meta.dayStart}
              end={draft.meta.dayEnd}
              onStart={(dayStart) => setDraft({ ...draft, meta: { ...draft.meta, dayStart } })}
              onEnd={(dayEnd) => setDraft({ ...draft, meta: { ...draft.meta, dayEnd } })}
            />

            <SlotOption
              id="slot-night"
              label="Night party"
              description="An evening sitting, usually running past midnight."
              checked={draft.meta.nightSlot}
              onToggle={(nightSlot) => setDraft({ ...draft, meta: { ...draft.meta, nightSlot } })}
              start={draft.meta.nightStart}
              end={draft.meta.nightEnd}
              onStart={(nightStart) => setDraft({ ...draft, meta: { ...draft.meta, nightStart } })}
              onEnd={(nightEnd) => setDraft({ ...draft, meta: { ...draft.meta, nightEnd } })}
            />

            <div className={styles.slotBlock}>
              <Checkbox
                id="slot-overnight"
                label="Overnight stay"
                checked={draft.meta.overnight}
                onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, overnight: e.target.checked } })}
              />
              <p className={styles.slotHint}>Guests stay the night and check out the next day.</p>
              {draft.meta.overnight ? (
                <div className={styles.twoCol}>
                  <TimeField
                    id="checkin"
                    label="Check-in time"
                    value={draft.meta.checkIn}
                    onChange={(checkIn) => setDraft({ ...draft, meta: { ...draft.meta, checkIn } })}
                  />
                  <TimeField
                    id="checkout"
                    label="Check-out time"
                    value={draft.meta.checkOut}
                    onChange={(checkOut) => setDraft({ ...draft, meta: { ...draft.meta, checkOut } })}
                  />
                </div>
              ) : null}
            </div>

          </fieldset>
          <Textarea id="cancel" label="Cancellation policy" rows={4} value={draft.cancellationPolicy} onChange={(e) => setDraft({ ...draft, cancellationPolicy: e.target.value })} />
          <Textarea id="party" label="Party rules" rows={4} value={draft.partyRules} onChange={(e) => setDraft({ ...draft, partyRules: e.target.value })} />
          <PolicySelect
            id="smoking"
            label="Smoking"
            options={SMOKING_OPTIONS}
            value={draft.meta.smoking}
            onChange={(smoking) => setDraft({ ...draft, meta: { ...draft.meta, smoking } })}
          />
          <PolicySelect
            id="pets"
            label="Pets"
            options={PET_OPTIONS}
            value={draft.meta.pets}
            onChange={(pets) => setDraft({ ...draft, meta: { ...draft.meta, pets } })}
          />
          <Input id="noise" label="Noise rules" value={draft.meta.noise} onChange={(e) => setDraft({ ...draft, meta: { ...draft.meta, noise: e.target.value } })} />
          <Textarea id="house" label="House rules" rows={5} value={draft.houseRules} onChange={(e) => setDraft({ ...draft, houseRules: e.target.value })} />
          <Checkbox id="party-flag" label="This stay is party-friendly" checked={draft.isPartyFriendly} onChange={(e) => setDraft({ ...draft, isPartyFriendly: e.target.checked })} />
          <Checkbox
            id="adult-only"
            label="Guests must be 18 or older"
            checked={draft.isAdultOnly}
            onChange={(e) => setDraft({ ...draft, isAdultOnly: e.target.checked })}
          />
          <Checkbox
            id="couple-friendly"
            label="Couple friendly — unmarried couples are welcome"
            checked={draft.isCoupleFriendly}
            onChange={(e) => setDraft({ ...draft, isCoupleFriendly: e.target.checked })}
          />
          <p className="t-caption">
            Guests filter on these, so only tick what you will actually honour at check-in.
          </p>
        </div>
      ) : null}

      {step === 7 ? <AvailabilityCalendar propertyId={draft.id} /> : null}

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
            <PropertyGallery
              title={draft.title || 'Your listing'}
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
        <VerificationStep onStatus={(next) => setKyc(next)} />
      ) : null}

      {step === 10 ? (
        <div className={styles.panel}>
          <h2 className="t-h3">Submit for approval</h2>
          <p className="t-body">
            Reviewers will check photos, location, and house rules. Owners cannot approve their own property or change guest booking statuses from this portal.
          </p>
          <p className="t-body-small">Current status: {draft.status || 'DRAFT'}</p>
          <p className="t-body-small">
            Submitting a listing means you accept the{' '}
            <Link href="/terms/host">Host Terms &amp; Conditions</Link>, including the accuracy,
            safety and cancellation obligations they set out.
          </p>
          {kyc && !kyc.canSubmitListing ? (
            <p className="t-body-small" role="status" style={{ color: 'var(--color-warning)' }}>
              {!kyc.phoneVerified
                ? 'Verify your mobile number on the Verification step before submitting.'
                : 'Add your Aadhaar and PAN on the Verification step before submitting.'}
            </p>
          ) : null}
          <Button
            onClick={() => void submit()}
            disabled={
              busy || draft.status === 'PENDING_APPROVAL' || (kyc ? !kyc.canSubmitListing : false)
            }
          >
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
          Back
        </Button>
        {step < WIZARD_STEPS.length - 1 ? (
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
    if (draft.images.length > MAX_PHOTOS) return { photos: `Add no more than ${MAX_PHOTOS} photos.` };
    return {};
  }
  if (step === 5) {
    if (draft.weekdayPrice <= 0) return { price: 'Set a weekday price.' };
    if (draft.meta.minStay < 1) return { minStay: 'Minimum stay must be at least 1 night.' };
    return {};
  }
  if (step === 6) {
    // A listing with every sitting switched off cannot be booked at all, which
    // is never what a host means to publish.
    if (!draft.meta.daySlot && !draft.meta.nightSlot && !draft.meta.overnight) {
      return { slots: 'Choose at least one — day party, night party or overnight stay.' };
    }
    return {};
  }
  return {};
}

/**
 * A house policy chosen from a fixed list rather than typed.
 *
 * Any stored value that is not one of the options stays in the list and stays
 * selected, so opening an old listing cannot quietly rewrite a policy its host
 * never touched.
 */
function PolicySelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const choices = policyOptions(options, value);
  const selected = selectedPolicy(options, value);

  return (
    <Select
      id={id}
      label={label}
      value={selected}
      onChange={(event) => onChange(event.target.value)}
    >
      {choices.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </Select>
  );
}

/**
 * One bookable sitting: a switch, and the hours it runs once switched on.
 *
 * The times stay hidden until the slot is enabled — a host who does not run day
 * parties should not have to scroll past two controls that mean nothing to them.
 * The live summary underneath is what catches a night slot entered backwards,
 * since "7:00 pm – 6:00 am · 11 hrs" reads wrong immediately if it says 1 hr.
 */
function SlotOption({
  id,
  label,
  description,
  checked,
  onToggle,
  start,
  end,
  onStart,
  onEnd,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (value: boolean) => void;
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  return (
    <div className={styles.slotBlock}>
      <Checkbox
        id={id}
        label={label}
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <p className={styles.slotHint}>{description}</p>
      {checked ? (
        <>
          <div className={styles.twoCol}>
            <TimeField id={`${id}-start`} label="Starts" value={start} onChange={onStart} />
            <TimeField id={`${id}-end`} label="Ends" value={end} onChange={onEnd} />
          </div>
          <p className={styles.slotSummary}>{formatSlotRange(start, end)}</p>
        </>
      ) : null}
    </div>
  );
}

export { AvailabilityCalendar as AvailabilityEditor };
