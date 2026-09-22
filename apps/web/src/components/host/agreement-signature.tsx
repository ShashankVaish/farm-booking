'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/forms';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type HostAgreementView } from '@/lib/host/host-api';
import { parseAgreementText } from '@/lib/legal/agreement-text';
import { ApiError } from '@/lib/api/errors';
import styles from './agreement-signature.module.css';

export type SignatureState = {
  /** The version on screen, so the caller can sign against exactly it. */
  agreementId: string | null;
  /** Already signed for this listing against the current version. */
  signed: boolean;
  agreed: boolean;
  signatureName: string;
};

type Props = {
  /** Unknown until the draft is first saved; the text still shows without it. */
  propertyId?: string;
  /** The account name, offered as the default signature. */
  defaultName?: string;
  value: SignatureState;
  onChange: (next: SignatureState) => void;
  disabled?: boolean;
};

/**
 * The host agreement as the wizard shows it: the admin-written text, then a
 * checkbox and a typed-name signature.
 *
 * The text is fetched live rather than bundled, because it is the admin's to
 * change; whatever version is active when the host opens this step is the one
 * they sign, and the caller sends that version's id with the signature.
 *
 * Once a listing is signed against the current version the form collapses to
 * a receipt. It re-opens by itself if the admin publishes a new version,
 * because the receipt only exists for the *current* one.
 */
export function AgreementSignature({ propertyId, defaultName, value, onChange, disabled }: Props) {
  const [view, setView] = useState<HostAgreementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hostApi
      .agreement(propertyId)
      .then((next) => {
        if (cancelled) return;
        setView(next);
        setError(null);
        onChange({
          agreementId: next.agreement.id,
          signed: Boolean(next.acceptance),
          agreed: Boolean(next.acceptance) || value.agreed,
          signatureName: next.acceptance?.signatureName ?? value.signatureName ?? '',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load the host agreement.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only refetch when the listing identity changes; the form state lives in `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  if (loading) return <Spinner label="Loading the host agreement" />;
  if (error || !view) return <ErrorState description={error ?? 'Could not load the host agreement.'} />;

  const { agreement, acceptance } = view;
  const blocks = parseAgreementText(agreement.body);

  return (
    <section className={styles.wrap} aria-labelledby="agreement-heading">
      <div className={styles.head}>
        <h3 id="agreement-heading" className="t-h4">
          {agreement.title}
        </h3>
        <p className="t-caption">
          Version {agreement.version} · published{' '}
          {new Date(agreement.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/*
        A bounded, scrollable box rather than the full text inline: a host on a
        phone should be able to find the signature without a very long scroll,
        and the box makes it obvious there is more to read.
      */}
      <div className={styles.document} tabIndex={0} role="region" aria-label="Agreement text">
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            return (
              <h4 key={index} className={styles.docHeading}>
                {block.text}
              </h4>
            );
          }
          if (block.kind === 'list') {
            return (
              <ul key={index} className={styles.docList}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className={styles.docParagraph}>
              {block.text}
            </p>
          );
        })}
      </div>

      {acceptance ? (
        <p className={styles.receipt} role="status">
          Signed as <strong>{acceptance.signatureName}</strong> on{' '}
          {new Date(acceptance.acceptedAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          for version {acceptance.agreement.version}.
        </p>
      ) : (
        <div className={styles.sign}>
          <label className={styles.agree}>
            <input
              type="checkbox"
              checked={value.agreed}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, agreed: event.target.checked })}
            />
            <span>I have read the {agreement.title} above and agree to be bound by it for this listing.</span>
          </label>
          <Input
            id="agreement-signature"
            label="Type your full name as your signature"
            value={value.signatureName}
            placeholder={defaultName}
            disabled={disabled}
            autoComplete="name"
            onChange={(event) => onChange({ ...value, signatureName: event.target.value })}
            hint="This is recorded with the date, time and the version you signed, and shown to the reviewer."
          />
        </div>
      )}
    </section>
  );
}
