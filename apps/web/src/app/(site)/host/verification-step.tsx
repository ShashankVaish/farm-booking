'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { Spinner } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/errors';
import { hostApi, type HostKycStatus } from '@/lib/host/host-api';
import { indianMobile } from '@/lib/auth/form';
import { uploadMedia, resolveMedia } from '@/lib/media/provider';
import { validateListingImage } from '@/lib/media/upload';
import styles from './host.module.css';

/** Mirrors the server check so the form fails fast on a mistyped number. */
function looksLikeAadhaar(value: string): boolean {
  return /^\d{12}$/.test(value.replace(/[\s-]/g, ''));
}

function looksLikePan(value: string): boolean {
  return /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(value.trim());
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/*
  Identity belongs to the host account, not to a property. A host with three
  farmhouses has one Aadhaar, one PAN and one payout account — OwnerProfile is
  keyed by userId — so the listing wizard must not read as though it is
  collecting them again for every new listing.

  In the 'listing' context a host who is already cleared gets a short
  confirmation instead of the forms. The 'account' context, used by host
  settings, always shows the full editable panels because that is where this
  information is meant to be managed.
*/
export function VerificationStep({
  onStatus,
  context = 'listing',
}: {
  onStatus?: (status: HostKycStatus) => void;
  context?: 'listing' | 'account';
}) {
  const [status, setStatus] = useState<HostKycStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [aadhaarImage, setAadhaarImage] = useState('');
  const [panImage, setPanImage] = useState('');
  const [uploading, setUploading] = useState<'aadhaar' | 'pan' | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const [holder, setHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [editingBank, setEditingBank] = useState(false);

  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  function applyStatus(next: HostKycStatus) {
    setStatus(next);
    setPhone((current) => current || next.phone || '');
    setPan((current) => current || next.panNumber || '');
    setAadhaarImage((current) => current || next.aadhaarImageUrl || '');
    setPanImage((current) => current || next.panImageUrl || '');
    setHolder((current) => current || next.bankAccountName || '');
    setIfsc((current) => current || next.bankIfsc || '');
    setBankName((current) => current || next.bankName || '');
    onStatusRef.current?.(next);
  }

  useEffect(() => {
    hostApi
      .kyc()
      .then(applyStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
    // Runs once: later refreshes come from the mutations below.
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function sendOtp() {
    const mobile = indianMobile(phone);
    if (!mobile) {
      setPhoneError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const result = await hostApi.requestKycPhoneOtp(mobile);
      setOtpSent(true);
      const wait = Math.ceil((new Date(result.resendAvailableAt).getTime() - Date.now()) / 1000);
      setSeconds(wait > 0 ? wait : 60);
    } catch (err) {
      setPhoneError(message(err, 'Could not send the code. Try again.'));
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmOtp() {
    const mobile = indianMobile(phone);
    if (!mobile) {
      setPhoneError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      applyStatus(await hostApi.verifyKycPhoneOtp(mobile, code.trim()));
      setOtpSent(false);
      setCode('');
    } catch (err) {
      setPhoneError(message(err, 'That code could not be verified.'));
    } finally {
      setPhoneBusy(false);
    }
  }

  async function upload(kind: 'aadhaar' | 'pan', file: File) {
    const invalid = validateListingImage(file);
    if (invalid) {
      setDocError(invalid);
      return;
    }
    setUploading(kind);
    setDocError(null);
    try {
      const result = await uploadMedia(file);
      if (kind === 'aadhaar') setAadhaarImage(result.url);
      else setPanImage(result.url);
    } catch (err) {
      setDocError(message(err, 'That photo could not be uploaded.'));
    } finally {
      setUploading(null);
    }
  }

  async function submitDocuments() {
    if (!looksLikeAadhaar(aadhaar)) {
      setDocError('Enter the 12-digit Aadhaar number.');
      return;
    }
    if (!looksLikePan(pan)) {
      setDocError('Enter a valid PAN, for example ABCDE1234F.');
      return;
    }
    if (!aadhaarImage || !panImage) {
      setDocError('Upload a photo of both documents.');
      return;
    }
    setDocBusy(true);
    setDocError(null);
    try {
      applyStatus(
        await hostApi.submitKyc({
          aadhaarNumber: aadhaar.replace(/[\s-]/g, ''),
          aadhaarImageUrl: aadhaarImage,
          panNumber: pan.trim().toUpperCase(),
          panImageUrl: panImage,
        }),
      );
      setAadhaar('');
    } catch (err) {
      setDocError(message(err, 'Your documents could not be submitted.'));
    } finally {
      setDocBusy(false);
    }
  }

  async function saveBank() {
    if (holder.trim().length < 3) {
      setBankError("Enter the account holder's full name.");
      return;
    }
    if (!/^\d{9,18}$/.test(accountNumber.replace(/[\s-]/g, ''))) {
      setBankError('Enter a valid account number (9 to 18 digits).');
      return;
    }
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim())) {
      setBankError('Enter a valid IFSC, for example HDFC0001234.');
      return;
    }
    setBankBusy(true);
    setBankError(null);
    try {
      applyStatus(
        await hostApi.saveBankAccount({
          accountHolderName: holder.trim(),
          accountNumber: accountNumber.replace(/[\s-]/g, ''),
          ifsc: ifsc.trim().toUpperCase(),
          bankName: bankName.trim() || undefined,
        }),
      );
      setEditingBank(false);
      setAccountNumber('');
    } catch (err) {
      setBankError(message(err, 'Your bank details could not be saved.'));
    } finally {
      setBankBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading verification" />;

  const phoneVerified = Boolean(status?.phoneVerified);
  const docsDone = status?.kycStatus === 'SUBMITTED' || status?.kycStatus === 'VERIFIED';
  const bankSaved = Boolean(status?.bankAccountSaved);
  const allDone = phoneVerified && docsDone && bankSaved;

  // Nothing here changes from one property to the next, so a host who has
  // already been through it should not be shown the forms a second time.
  if (context === 'listing' && allDone) {
    return (
      <div className={styles.panel}>
        <div className={styles.verifyHead}>
          <h2 className="t-h3">Identity already verified</h2>
          <span className={styles.verifyDone}>
            {status?.kycStatus === 'VERIFIED' ? 'Verified' : 'Under review'}
          </span>
        </div>
        <p className="t-body-small" style={{ marginTop: 'var(--space-2)', maxWidth: '44rem' }}>
          Your Aadhaar, PAN and payout account belong to your account rather than to any one
          property, so they already cover this listing and every other one you publish. There is
          nothing to re-enter here.
        </p>
        <dl className={styles.factGrid}>
          <div className={styles.fact}>
            <dt className="t-caption">Mobile</dt>
            <dd>{status?.phone ? `+91 ${status.phone}` : 'Verified'}</dd>
          </div>
          <div className={styles.fact}>
            <dt className="t-caption">Aadhaar</dt>
            <dd>{status?.aadhaarMasked || '—'}</dd>
          </div>
          <div className={styles.fact}>
            <dt className="t-caption">PAN</dt>
            <dd>{status?.panNumber || '—'}</dd>
          </div>
          <div className={styles.fact}>
            <dt className="t-caption">Payout account</dt>
            <dd>{status?.bankAccountMasked || '—'}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button variant="secondary" href="/host/settings">
            Manage in account settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className="t-h3">Verify your identity</h2>
      <p className="t-body-small" style={{ marginTop: 'var(--space-2)', maxWidth: '44rem' }}>
        Guests book stays from hosts we have checked. This is a one-time check on your account —
        once it clears it covers every property you list, so you will not be asked again. Your
        documents are visible only to our review team.
      </p>

      {/* Step 1 — mobile ------------------------------------------------- */}
      <section className={styles.verifyBlock}>
        <div className={styles.verifyHead}>
          <h3 className="t-h4">1. Mobile number</h3>
          <span className={phoneVerified ? styles.verifyDone : styles.verifyPending}>
            {phoneVerified ? 'Verified' : 'Not verified'}
          </span>
        </div>

        {phoneVerified ? (
          <p className="t-body-small">
            Verified on {status?.phone ? `+91 ${status.phone}` : 'your registered number'}.
          </p>
        ) : (
          <>
            <div className={styles.twoCol}>
              <Input
                id="kyc-phone"
                label="Mobile number"
                inputMode="numeric"
                placeholder="10-digit Indian mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {otpSent ? (
                <Input
                  id="kyc-otp"
                  label="OTP"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              ) : null}
            </div>
            {phoneError ? (
              <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
                {phoneError}
              </p>
            ) : null}
            <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>
              {otpSent ? (
                <>
                  <Button onClick={() => void confirmOtp()} disabled={phoneBusy || code.trim().length < 6}>
                    {phoneBusy ? 'Verifying…' : 'Verify code'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={seconds > 0 || phoneBusy}
                    onClick={() => void sendOtp()}
                  >
                    {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => void sendOtp()} disabled={phoneBusy}>
                  {phoneBusy ? 'Sending…' : 'Send OTP'}
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Step 2 — documents ---------------------------------------------- */}
      <section className={styles.verifyBlock}>
        <div className={styles.verifyHead}>
          <h3 className="t-h4">2. Identity documents</h3>
          <span className={docsDone ? styles.verifyDone : styles.verifyPending}>
            {status?.kycStatus === 'VERIFIED'
              ? 'Verified'
              : status?.kycStatus === 'SUBMITTED'
                ? 'Under review'
                : status?.kycStatus === 'REJECTED'
                  ? 'Rejected'
                  : 'Not submitted'}
          </span>
        </div>

        {status?.kycStatus === 'REJECTED' && status.kycRejectionReason ? (
          <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
            {status.kycRejectionReason}
          </p>
        ) : null}

        {docsDone ? (
          <dl className={styles.factGrid}>
            <div className={styles.fact}>
              <dt className="t-caption">Aadhaar</dt>
              <dd>{status?.aadhaarMasked || '—'}</dd>
            </div>
            <div className={styles.fact}>
              <dt className="t-caption">PAN</dt>
              <dd>{status?.panNumber || '—'}</dd>
            </div>
          </dl>
        ) : !phoneVerified ? (
          <p className="t-body-small">Verify your mobile number first.</p>
        ) : (
          <>
            <div className={styles.twoCol}>
              <Input
                id="kyc-aadhaar"
                label="Aadhaar number"
                inputMode="numeric"
                placeholder="12 digits"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value)}
                hint="We store only the last 4 digits."
              />
              <Input
                id="kyc-pan"
                label="PAN"
                placeholder="ABCDE1234F"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
              />
            </div>

            <div className={styles.twoCol} style={{ marginTop: 'var(--space-4)' }}>
              <DocUpload
                id="kyc-aadhaar-photo"
                label="Aadhaar photo"
                url={aadhaarImage}
                busy={uploading === 'aadhaar'}
                onFile={(file) => void upload('aadhaar', file)}
              />
              <DocUpload
                id="kyc-pan-photo"
                label="PAN photo"
                url={panImage}
                busy={uploading === 'pan'}
                onFile={(file) => void upload('pan', file)}
              />
            </div>

            {docError ? (
              <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
                {docError}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button onClick={() => void submitDocuments()} disabled={docBusy || uploading !== null}>
                {docBusy ? 'Submitting…' : 'Submit for verification'}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Step 3 — payout account ----------------------------------------- */}
      <section className={styles.verifyBlock}>
        <div className={styles.verifyHead}>
          <h3 className="t-h4">3. Payout account</h3>
          <span className={status?.bankAccountSaved ? styles.verifyDone : styles.verifyPending}>
            {status?.bankAccountSaved ? 'Saved' : 'Not added'}
          </span>
        </div>
        <p className="t-body-small">
          Where we send your earnings after each completed stay. Guest refunds are handled
          separately and always return to the card or UPI the guest paid with.
        </p>

        {bankSaved ? (
          <dl className={styles.factGrid}>
            <div className={styles.fact}>
              <dt className="t-caption">Account</dt>
              <dd>{status?.bankAccountMasked}</dd>
            </div>
            <div className={styles.fact}>
              <dt className="t-caption">IFSC</dt>
              <dd>{status?.bankIfsc ?? '—'}</dd>
            </div>
            <div className={styles.fact}>
              <dt className="t-caption">Holder</dt>
              <dd>{status?.bankAccountName ?? '—'}</dd>
            </div>
          </dl>
        ) : null}

        {/* A saved account showed its summary and an empty form together, which
            read as though the details had not been stored after all. */}
        {bankSaved && !editingBank ? (
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setEditingBank(true)}>
              Change payout account
            </Button>
          </div>
        ) : (
        <>
        <div className={styles.twoCol} style={{ marginTop: 'var(--space-4)' }}>
          <Input
            id="bank-holder"
            label="Account holder name"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            hint="Exactly as it appears on the bank account."
          />
          <Input
            id="bank-account"
            label="Account number"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <Input
            id="bank-ifsc"
            label="IFSC"
            placeholder="HDFC0001234"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
          />
          <Input
            id="bank-name"
            label="Bank name (optional)"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </div>
        {bankError ? (
          <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
            {bankError}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => void saveBank()} disabled={bankBusy}>
            {bankBusy ? 'Saving…' : bankSaved ? 'Update account' : 'Save account'}
          </Button>
          {bankSaved ? (
            <Button variant="ghost" onClick={() => setEditingBank(false)} disabled={bankBusy}>
              Cancel
            </Button>
          ) : null}
        </div>
        </>
        )}
      </section>
    </div>
  );
}

function DocUpload({
  id,
  label,
  url,
  busy,
  onFile,
}: {
  id: string;
  label: string;
  url: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div>
      <label className="t-label" htmlFor={id}>
        {label}
      </label>
      <div className={styles.docBox}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMedia({ src: url, alt: label }).src} alt={label} className={styles.docPreview} />
        ) : (
          <p className="t-caption">JPEG, PNG or WebP · up to 8 MB</p>
        )}
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        {busy ? <p className="t-caption">Uploading…</p> : null}
      </div>
    </div>
  );
}
