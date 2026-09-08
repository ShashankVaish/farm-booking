'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { useToast } from '@/components/providers/toast-provider';
import { adminApi } from '@/lib/admin/api';
import { formatDateTime, formatInr, statusLabel } from '@/lib/admin/format';
import type { AdminPropertyDetail } from '@/lib/admin/types';
import { ApiError } from '@/lib/api/errors';
import { resolveMedia } from '@/lib/media/provider';
import { PROPERTY_TYPE_LABEL } from '@/lib/properties/types';
import { cn } from '@/lib/cn';
import styles from './property-review.module.css';

type Moderation = 'approve' | 'reject' | 'request-changes' | 'suspend' | 'restore';

const NEEDS_REASON: Moderation[] = ['reject', 'request-changes', 'suspend'];

const STATUS_CLASS: Record<string, string> = {
  PENDING_APPROVAL: styles.statusPending,
  APPROVED: styles.statusApproved,
  REJECTED: styles.statusRejected,
  SUSPENDED: styles.statusSuspended,
  CHANGES_REQUESTED: styles.statusChanges,
};

function actionsFor(status: string): Array<{ id: Moderation; label: string; danger?: boolean }> {
  switch (status) {
    case 'PENDING_APPROVAL':
      return [
        { id: 'approve', label: 'Approve' },
        { id: 'request-changes', label: 'Request changes' },
        { id: 'reject', label: 'Reject', danger: true },
      ];
    case 'CHANGES_REQUESTED':
      return [
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject', danger: true },
      ];
    case 'APPROVED':
      return [{ id: 'suspend', label: 'Suspend', danger: true }];
    case 'SUSPENDED':
      return [{ id: 'restore', label: 'Restore' }];
    default:
      return [];
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <p className={styles.rowLabel}>{label}</p>
      <div className={styles.rowValue}>{children}</div>
    </div>
  );
}

function Missing({ what }: { what: string }) {
  return <span className={styles.missing}>No {what} provided</span>;
}

export function PropertyReview({ propertyId }: { propertyId: string }) {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAdminQuery<AdminPropertyDetail>(
    () => adminApi.property(propertyId),
    [propertyId],
  );
  const [target, setTarget] = useState<Moderation | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(reason?: string) {
    if (!target) return;
    setBusy(true);
    try {
      if (target === 'approve') await adminApi.approveProperty(propertyId);
      if (target === 'reject') await adminApi.rejectProperty(propertyId, reason ?? '');
      if (target === 'request-changes') await adminApi.requestPropertyChanges(propertyId, reason ?? '');
      if (target === 'suspend') await adminApi.suspendProperty(propertyId, reason ?? '');
      if (target === 'restore') await adminApi.restoreProperty(propertyId);
      notify(`${statusLabel(target)} recorded in the audit log.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Moderation failed.', 'error');
    } finally {
      setTarget(null);
      setBusy(false);
      reload();
    }
  }

  return (
    <QueryGate loading={loading} error={error} onRetry={reload} label="Loading listing">
      {data ? (
        <div>
          <div className={styles.header}>
            <div style={{ minWidth: 0 }}>
              <p className="t-label">
                <Link href="/admin/properties">Properties</Link> · Verification
              </p>
              <h1 className={styles.title}>{data.title}</h1>
              <p className={styles.subtitle}>
                {PROPERTY_TYPE_LABEL[data.propertyType] ?? statusLabel(data.propertyType)} ·{' '}
                {data.location.city}, {data.location.state} · Submitted{' '}
                {formatDateTime(data.createdAt)}
              </p>
            </div>
            <span className={cn(styles.status, STATUS_CLASS[data.status])}>
              {statusLabel(data.status)}
            </span>
          </div>

          <div className={styles.actionBar}>
            <p className={styles.actionNote}>
              {actionsFor(data.status).length > 0
                ? 'Every decision is written to the audit log and the owner is notified.'
                : `No moderation actions apply while this listing is ${statusLabel(data.status).toLowerCase()}.`}
            </p>
            <div className={styles.actionButtons}>
              {data.status === 'APPROVED' ? (
                <Button size="sm" variant="ghost" href={`/properties/${data.id}`}>
                  View public page
                </Button>
              ) : null}
              {actionsFor(data.status).map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant={action.danger ? 'danger' : action.id === 'approve' ? 'primary' : 'secondary'}
                  onClick={() => setTarget(action.id)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          <div className={styles.layout}>
            <div className={styles.column}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Photos ({data.images.length})</h2>
                <p className={styles.checklist}>
                  Check that photos show the actual property, are not watermarked or taken from
                  stock sites, and that a cover image is set.
                </p>
                {data.images.length === 0 ? (
                  <Missing what="photos" />
                ) : (
                  <div className={styles.gallery}>
                    {data.images.map((image) => (
                      <figure key={image.id} className={styles.shot}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMedia({ src: image.url, alt: image.altText ?? data.title }).src}
                          alt={image.altText ?? `${data.title} photo`}
                          loading="lazy"
                        />
                        {image.isCover ? <span className={styles.coverTag}>Cover</span> : null}
                        <figcaption className={styles.shotAlt}>
                          {image.altText ?? 'No alt text'}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Description</h2>
                {data.description?.trim() ? (
                  <p className={styles.prose}>{data.description}</p>
                ) : (
                  <Missing what="description" />
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Location</h2>
                <p className={styles.checklist}>
                  Confirm the address and the map pin agree. An approved listing exposes this
                  location to guests.
                </p>
                <div className={styles.rows}>
                  <Row label="Address">{data.location.address || <Missing what="address" />}</Row>
                  <Row label="Area">{data.location.location || '—'}</Row>
                  <Row label="City / state">
                    {data.location.city}, {data.location.state}
                  </Row>
                  <Row label="Pincode">{data.location.pincode || <Missing what="pincode" />}</Row>
                  <Row label="Coordinates">
                    <a
                      className={styles.mapLink}
                      href={`https://www.google.com/maps?q=${data.location.latitude},${data.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {data.location.latitude.toFixed(5)}, {data.location.longitude.toFixed(5)} ↗
                    </a>
                  </Row>
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Capacity & pricing</h2>
                <div className={styles.rows}>
                  <Row label="Guests">{data.capacity.guests}</Row>
                  <Row label="Bedrooms">{data.capacity.bedrooms}</Row>
                  <Row label="Bathrooms">{data.capacity.bathrooms}</Row>
                  <Row label="Weekday rate">{formatInr(data.pricing.basePrice)}</Row>
                  <Row label="Weekend rate">
                    {data.pricing.weekendPrice ? formatInr(data.pricing.weekendPrice) : 'Same as weekday'}
                  </Row>
                  <Row label="Extra guest">
                    {data.pricing.extraGuestCharge
                      ? formatInr(data.pricing.extraGuestCharge)
                      : 'Not charged'}
                  </Row>
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Amenities ({data.amenities.length})</h2>
                {data.amenities.length === 0 ? (
                  <Missing what="amenities" />
                ) : (
                  <div className={styles.chips}>
                    {data.amenities.map((amenity) => (
                      <span key={amenity.id} className={styles.chip}>
                        {amenity.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Rules & policy</h2>
                <div className={styles.rows}>
                  <Row label="Party friendly">{data.isPartyFriendly ? 'Yes' : 'No'}</Row>
                  <Row label="House rules">
                    {data.rules.propertyRules ? (
                      <span className={styles.prose}>{data.rules.propertyRules}</span>
                    ) : (
                      <Missing what="house rules" />
                    )}
                  </Row>
                  <Row label="Party rules">
                    {data.rules.partyRules ? (
                      <span className={styles.prose}>{data.rules.partyRules}</span>
                    ) : (
                      <Missing what="party rules" />
                    )}
                  </Row>
                  <Row label="Cancellation">
                    {data.rules.cancellationPolicy ? (
                      <span className={styles.prose}>{data.rules.cancellationPolicy}</span>
                    ) : (
                      <Missing what="cancellation policy" />
                    )}
                  </Row>
                </div>
              </section>
            </div>

            <div className={styles.column}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Owner</h2>
                <div className={styles.rows}>
                  <Row label="Name">{data.owner.name}</Row>
                  <Row label="Email">{data.owner.email}</Row>
                  <Row label="Phone">
                    {data.owner.phone ? (
                      <>
                        {data.owner.phone}
                        <div
                          className={cn(
                            styles.kyc,
                            data.owner.phoneVerified ? styles.kycYes : styles.kycNo,
                          )}
                        >
                          {data.owner.phoneVerified ? 'OTP verified' : 'Not verified'}
                        </div>
                      </>
                    ) : (
                      <Missing what="phone" />
                    )}
                  </Row>
                  <Row label="Account">
                    {data.owner.isActive ? 'Active' : 'Disabled'} · member since{' '}
                    {formatDateTime(data.owner.memberSince)}
                  </Row>
                  <Row label="KYC">
                    <span
                      className={cn(
                        styles.kyc,
                        data.owner.profile?.kycVerified ? styles.kycYes : styles.kycNo,
                      )}
                    >
                      {data.owner.profile?.kycVerified ? 'Verified' : 'Not verified'}
                    </span>
                  </Row>
                  <Row label="Business">
                    {data.owner.profile?.businessName || <Missing what="business name" />}
                  </Row>
                  <Row label="GST">{data.owner.profile?.gstNumber || <Missing what="GST" />}</Row>
                  <Row label="PAN">{data.owner.profile?.panNumber || <Missing what="PAN" />}</Row>
                  <Row label="Other listings">{data.owner.otherListings}</Row>
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Identity documents</h2>
                <p className={styles.checklist}>
                  Check the name on each document against the account holder. Only the last four
                  Aadhaar digits are stored — compare them against the uploaded photo.
                </p>
                <div className={styles.rows}>
                  <Row label="KYC status">
                    <span
                      className={cn(
                        styles.kyc,
                        data.owner.profile?.kycStatus === 'VERIFIED' ? styles.kycYes : styles.kycNo,
                      )}
                    >
                      {statusLabel(data.owner.profile?.kycStatus ?? 'NOT_SUBMITTED')}
                    </span>
                  </Row>
                  <Row label="Submitted">
                    {data.owner.profile?.kycSubmittedAt
                      ? formatDateTime(data.owner.profile.kycSubmittedAt)
                      : <Missing what="submission" />}
                  </Row>
                  <Row label="Aadhaar">
                    {data.owner.profile?.aadhaarLast4 ? (
                      `XXXX XXXX ${data.owner.profile.aadhaarLast4}`
                    ) : (
                      <Missing what="Aadhaar" />
                    )}
                  </Row>
                  <Row label="PAN">
                    {data.owner.profile?.panNumber || <Missing what="PAN" />}
                  </Row>
                </div>
                {data.owner.profile?.aadhaarImageUrl || data.owner.profile?.panImageUrl ? (
                  <div className={styles.gallery} style={{ marginTop: 'var(--space-4)' }}>
                    {data.owner.profile?.aadhaarImageUrl ? (
                      <figure className={styles.shot}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMedia({ src: data.owner.profile.aadhaarImageUrl, alt: 'Aadhaar' }).src}
                          alt="Aadhaar document"
                          loading="lazy"
                        />
                        <figcaption className={styles.shotAlt}>Aadhaar</figcaption>
                      </figure>
                    ) : null}
                    {data.owner.profile?.panImageUrl ? (
                      <figure className={styles.shot}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMedia({ src: data.owner.profile.panImageUrl, alt: 'PAN' }).src}
                          alt="PAN document"
                          loading="lazy"
                        />
                        <figcaption className={styles.shotAlt}>PAN</figcaption>
                      </figure>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Track record</h2>
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <p className={styles.statValue}>{data.stats.bookings}</p>
                    <p className={styles.statLabel}>Bookings</p>
                  </div>
                  <div className={styles.stat}>
                    <p className={styles.statValue}>{data.stats.reviews}</p>
                    <p className={styles.statLabel}>Reviews</p>
                  </div>
                  <div className={styles.stat}>
                    <p className={styles.statValue}>
                      {data.stats.averageRating ? data.stats.averageRating.toFixed(1) : '—'}
                    </p>
                    <p className={styles.statLabel}>Rating</p>
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Documents ({data.documents.length})</h2>
                {data.documents.length === 0 ? (
                  <Missing what="documents" />
                ) : (
                  <div className={styles.rows}>
                    {data.documents.map((document) => (
                      <Row key={document.id} label={document.documentType}>
                        <a href={document.url} target="_blank" rel="noopener noreferrer">
                          {document.name} ↗
                        </a>
                        <div className="t-caption">{statusLabel(document.status)}</div>
                      </Row>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Moderation history</h2>
                {data.auditTrail.length === 0 ? (
                  <p className="t-body-small">Nothing recorded yet.</p>
                ) : (
                  <ul className={styles.trail}>
                    {data.auditTrail.map((entry) => (
                      <li key={entry.id} className={styles.trailItem}>
                        <span className={styles.trailAction}>{statusLabel(entry.action)}</span>
                        <span className={styles.trailMeta}>
                          {entry.actor?.name ?? 'System'} · {formatDateTime(entry.createdAt)}
                        </span>
                        {entry.metadata?.reason ? (
                          <p className={styles.trailReason}>“{entry.metadata.reason}”</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <ConfirmDialog
            open={Boolean(target)}
            title={target ? `${statusLabel(target)} this listing?` : ''}
            description={
              target
                ? `${data.title} will change status. The owner is notified and the action is audited.`
                : ''
            }
            confirmLabel={target ? statusLabel(target) : 'Confirm'}
            danger={target ? NEEDS_REASON.includes(target) && target !== 'request-changes' : false}
            reasonRequired={target ? NEEDS_REASON.includes(target) : false}
            busy={busy}
            onClose={() => setTarget(null)}
            onConfirm={(reason) => void run(reason)}
          />
        </div>
      ) : null}
    </QueryGate>
  );
}
