'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { memoryTokenStore } from '@/lib/api/token-store';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { bookingApi } from '@/lib/bookings/api';
import { openBookingKey } from '@/lib/bookings/types';
import { handOffBooking } from '@/lib/bookings/booking-handoff';
import { EmailGate } from '@/components/booking/email-gate';
import type { BookingSlotKey, PriceQuote } from '@/lib/bookings/types';
import { bookableSlots, partyDateLabel } from '@/lib/bookings/slots';
import type { ApiProperty } from '@/lib/properties/types';
import { getAvailability } from '@/lib/properties/api';
import {
  addDaysIso,
  nightsBetween,
  shortStayLabel,
  suggestOneNight,
  todayIso,
} from '@/lib/bookings/date-picker';
import { cn } from '@/lib/cn';
import { PriceBreakdown } from './price-breakdown';
import { StayDatePicker } from './stay-date-picker';
import styles from './hospitality.module.css';

export function PropertyBookingCard({
  property,
  bookable = true,
}: {
  property: ApiProperty;
  bookable?: boolean;
}) {
  const router = useRouter();
  /*
    Day party and/or night party — only what the host offers, the same list
    "How you can book it" shows. The night party is picked first when offered:
    it is the listing's own price, the one shown on its card in search.
  */
  const slots = useMemo(() => bookableSlots(property), [property]);
  const [slot, setSlot] = useState<BookingSlotKey>(
    () => (slots.find((option) => option.key === 'NIGHT') ?? slots[0])?.key ?? 'NIGHT',
  );
  const chosen = slots.find((option) => option.key === slot) ?? null;
  const isParty = slot !== 'OVERNIGHT';
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // True while the dates are the ones we picked, not the guest.
  const [suggested, setSuggested] = useState(false);
  // Phone sign-ups confirm an email before their first booking.
  const [emailGateOpen, setEmailGateOpen] = useState(false);
  /*
    Phones only: the card is a bottom sheet opened from the sticky Reserve bar,
    so the page itself carries no calendar. From 1024px the card sits in the
    page and this flag changes nothing visible.
  */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const submitting = useRef(false);
  const guestPicked = useRef(false);

  /*
    Load the checkout page's code while the guest is still reading the
    listing, so Reserve navigates without waiting for it. The page renders the
    same shell for any id (the booking itself comes from the client), so a
    placeholder id warms exactly what the real navigation will need.
  */
  useEffect(() => {
    if (bookable) router.prefetch('/booking/00000000-0000-4000-8000-000000000000');
  }, [bookable, router]);

  /*
    Pre-fill one free night so a guest on a phone can reserve in one tap from
    the sticky bar. Only ever fills an empty card: if the guest has already
    touched the calendar by the time availability arrives, their choice stands.
  */
  useEffect(() => {
    if (!bookable) return;
    let cancelled = false;
    const today = todayIso();
    getAvailability(property.id, today, addDaysIso(today, 32))
      .then((days) => {
        if (cancelled || guestPicked.current) return;
        const stay = suggestOneNight(days, { today });
        if (!stay) return;
        setCheckIn(stay.checkIn);
        setCheckOut(stay.checkOut);
        setSuggested(true);
      })
      .catch(() => {
        // No suggestion is fine; the guest picks from the calendar.
      });
    return () => {
      cancelled = true;
    };
  }, [bookable, property.id]);

  // While the sheet is open on a phone: Escape closes it and the page behind
  // stops scrolling, so a swipe inside the calendar never scrolls the listing.
  useEffect(() => {
    if (!sheetOpen) return;
    const phone = window.matchMedia('(max-width: 1023px)').matches;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    if (phone) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (!bookable || !checkIn || !checkOut) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setQuoting(true);
      try {
        const result = await bookingApi.quote({
          propertyId: property.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestCount,
          couponCode: appliedCoupon || undefined,
          slot,
        });
        if (!cancelled) {
          setQuote(result);
          setError(null);
          if (appliedCoupon) {
            setCouponMessage(Number(result.discountAmount) > 0 ? 'Coupon applied to this quote.' : 'Coupon did not change this total.');
          } else {
            setCouponMessage(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setCouponMessage(null);
          setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Those dates are not available.');
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, guestCount, appliedCoupon, property.id, bookable, slot]);

  function chooseSlot(next: BookingSlotKey) {
    if (next === slot || busy) return;
    setSlot(next);
    setError(null);
    // A party is one date: keep the first night of a longer stay.
    if (next !== 'OVERNIGHT' && checkIn) {
      setCheckOut(addDaysIso(checkIn, 1));
    }
  }

  async function onReserve(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!memoryTokenStore.getAccessToken()) {
      router.push(`/auth/login?next=/properties/${property.id}`);
      return;
    }
    if (!checkIn || !checkOut) {
      setError(isParty ? 'Choose a date.' : 'Choose check-in and check-out dates.');
      setSheetOpen(true);
      return;
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const storedKey = openBookingKey(property.id, checkIn, checkOut, guestCount, slot);
      const existingId = sessionStorage.getItem(storedKey);
      if (existingId) {
        router.push(`/booking/${existingId}`);
        return;
      }
      const result = await bookingApi.create({
        propertyId: property.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount,
        couponCode: appliedCoupon || undefined,
        slot,
      });
      sessionStorage.setItem(storedKey, result.booking.id);
      handOffBooking(result.booking);
      router.push(`/booking/${result.booking.id}`);
      // Stay on "Reserving…" until the checkout page replaces this one;
      // resetting here flashed "Reserve" again during the navigation, which
      // read as if the tap had not worked.
    } catch (err) {
      submitting.current = false;
      setBusy(false);
      /*
        The server refuses a booking from an account with no confirmed email
        (a phone sign-up). Asking it here, only when needed, costs everyone
        else nothing: no extra request before every Reserve.
      */
      if (err instanceof ApiError && err.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setError(null);
        setEmailGateOpen(true);
        return;
      }
      setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Could not start this booking.');
      // On a phone the message lives in the sheet, so bring it up.
      setSheetOpen(true);
    }
  }

  function afterEmailVerified() {
    setEmailGateOpen(false);
    // Carry on with the booking the guest was making.
    (document.getElementById('book-form') as HTMLFormElement | null)?.requestSubmit();
  }

  const nightly = Number(property.basePrice);
  // What one unit costs in the header and the phone bar before a quote lands.
  const unitPrice = chosen?.price ?? nightly;
  const unitLabel = isParty && chosen ? chosen.label.toLowerCase() : 'night';
  const weekendRate = property.weekendPrice ? Number(property.weekendPrice) : 0;
  const inr = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const nights = checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut).length : 0;
  const barTotal = quote ? Number(quote.totalAmount) : nights ? unitPrice * nights : unitPrice;
  const stayLabel = isParty && checkIn
    ? `${chosen?.label ?? 'Party'} · ${partyDateLabel(checkIn)}`
    : nights
      ? `For ${nights} ${nights === 1 ? 'night' : 'nights'} · ${shortStayLabel(checkIn, checkOut)}`
      : '';

  function openSheet() {
    setSheetOpen(true);
  }

  if (!bookable) {
    return (
      <aside className={styles.booking} aria-label="Booking">
        <p className="t-price">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
            nightly,
          )}{' '}
          <span className="t-caption">/ night</span>
        </p>
        <p className="t-body-small">
          {property.status && property.status !== 'APPROVED'
            ? 'This property is awaiting admin approval. Live dates and checkout will open after approval.'
            : 'This is a sample stay. Live dates and checkout are available on published listings.'}
        </p>
        <Button href="/explore" block>
          Browse live stays
        </Button>
      </aside>
    );
  }

  const panel = (
      <div
        className={cn(styles.bookingPanel, sheetOpen && styles.bookingPanelOpen)}
        role={sheetOpen ? 'dialog' : undefined}
        aria-modal={sheetOpen || undefined}
        aria-labelledby={sheetOpen ? 'booking-sheet-title' : undefined}
      >
      {/* Phone sheet header: what is being booked and for when. */}
      <div className={styles.sheetHead}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeadText}>
          <p className={styles.sheetTitle} id="booking-sheet-title">
            {chosen?.label ?? 'Your booking'}
          </p>
          <p className={styles.sheetSub}>
            {checkIn ? `${partyDateLabel(checkIn)} · ${chosen?.detail ?? ''}` : 'Pick a date on the calendar'}
          </p>
        </div>
        <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className={cn('t-price', styles.panelPrice)}>
        {inr(unitPrice)} <span className="t-caption">/ {unitLabel}</span>
      </p>
      <form id="book-form" onSubmit={onReserve}>
        {slots.length > 1 ? (
          <div className={styles.slotPicker} role="radiogroup" aria-label="What are you booking?">
            <p className={styles.slotPickerTitle}>What are you booking?</p>
            {slots.map((option) => {
              const active = option.key === slot;
              // Without its own price a sitting costs the listing's price for
              // the date, which is higher at weekends when the host says so.
              const price = option.price ?? nightly;
              const weekendNote = !option.price && weekendRate > 0 && weekendRate !== nightly;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  className={cn(styles.slotChoice, active && styles.slotChoiceActive)}
                  onClick={() => chooseSlot(option.key)}
                >
                  <span className={styles.slotChoiceText}>
                    <span className={styles.slotChoiceLabel}>{option.label}</span>
                    <span className={styles.slotChoiceDetail}>{option.detail}</span>
                  </span>
                  <span className={styles.slotChoicePrice}>
                    {inr(price)}
                    {weekendNote ? <span className={styles.slotChoiceWeekend}>Sat–Sun {inr(weekendRate)}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : chosen && isParty ? (
          <p className={styles.slotSingle}>
            <strong>{chosen.label}</strong> · {chosen.detail}
          </p>
        ) : null}
        <StayDatePicker
          mode={isParty ? 'single' : 'range'}
          flatPrice={isParty ? chosen?.price ?? null : null}
          propertyId={property.id}
          checkIn={checkIn}
          checkOut={checkOut}
          basePrice={Number(property.basePrice) || 0}
          weekendPrice={property.weekendPrice ? Number(property.weekendPrice) : null}
          onChange={(next) => {
            guestPicked.current = true;
            setSuggested(false);
            setCheckIn(next.checkIn);
            setCheckOut(next.checkOut);
            if (next.error) setError(next.error);
          }}
        />
        <p className="t-caption">
          {isParty
            ? checkIn
              ? `${chosen?.label ?? 'Party'} on ${partyDateLabel(checkIn)} · ${chosen?.detail ?? ''}`
              : 'Tap a date for your party'
            : `${checkIn ? `Check-in ${checkIn}` : 'Select check-in'}${checkOut ? ` · Check-out ${checkOut}` : ''}`}
        </p>
        <Input
          id="book-guests"
          label="Guests"
          type="number"
          min={1}
          max={property.guestCapacity}
          value={guestCount}
          disabled={busy}
          onChange={(e) => setGuestCount(Math.min(property.guestCapacity, Math.max(1, Number(e.target.value) || 1)))}
        />
        <Input
          id="coupon"
          label="Coupon"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          success={couponMessage ?? undefined}
          disabled={busy}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || !couponCode.trim()}
          onClick={() => setAppliedCoupon(couponCode.trim())}
        >
          Apply coupon
        </Button>
        {quoting ? <p className="t-caption" role="status">Updating price…</p> : null}
        {quote ? <PriceBreakdown quote={quote} /> : null}
        {error ? (
          <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        ) : null}
        {suggested && nights ? (
          <p className={styles.suggestNote} role="status">
            We picked {isParty ? partyDateLabel(checkIn) : shortStayLabel(checkIn, checkOut)} for you — tap any other date to change it.
          </p>
        ) : null}
        <div className={styles.panelReserve}>
          <Button type="submit" block loading={busy} disabled={busy || quoting || !checkIn || !checkOut}>
            {busy ? 'Reserving…' : 'Reserve'}
          </Button>
        </div>
      </form>

      {/* Phone sheet footer, like the calendar sheet on Airbnb: total + Save. */}
      <div className={styles.sheetFoot}>
        <span className={styles.sheetTotal}>
          <span key={barTotal} className={cn(styles.sheetTotalAmount, quoting && styles.reservePriceLoading)}>
            {inr(barTotal)}
          </span>
          <span className={styles.sheetTotalNote}>
            {nights ? `${chosen?.label ?? 'Total'} · ${partyDateLabel(checkIn)}` : `per ${unitLabel}`}
          </span>
        </span>
        <button
          type="button"
          className={styles.sheetSave}
          disabled={!nights}
          onClick={() => setSheetOpen(false)}
        >
          Save
        </button>
      </div>
      </div>
  );

  /*
    An open sheet on a phone is portalled to <body>. Inside the page it sits
    in the page-transition wrapper's stacking context, where no z-index can
    lift it above the site's bottom navigation — which then covered Save.
    The bar's Reserve still reaches the form: it targets it by id.
  */
  const sheet =
    sheetOpen && isPhone
      ? createPortal(
          <>
            <button
              type="button"
              className={styles.sheetBackdrop}
              aria-label="Close"
              tabIndex={-1}
              onClick={() => setSheetOpen(false)}
            />
            {panel}
          </>,
          document.body,
        )
      : panel;

  return (
    <aside className={styles.booking} aria-label="Booking">
      {sheet}

      <EmailGate open={emailGateOpen} onClose={() => setEmailGateOpen(false)} onVerified={afterEmailVerified} />

      {/*
        Phones only (hidden from 1024px up, where the card itself is sticky).
        The page shows no calendar on a phone: tapping the summary opens the
        card as a bottom sheet to change the date or slot. Reserve submits the
        card's own form, so both paths share one set of checks.
      */}
      <div className={styles.reserveBar} role="region" aria-label={isParty ? `Reserve this ${unitLabel}` : 'Reserve this stay'}>
        <button type="button" className={styles.reserveSummary} onClick={openSheet} aria-haspopup="dialog">
          <span key={barTotal} className={cn(styles.reservePrice, quoting && styles.reservePriceLoading)}>
            {inr(barTotal)}
            {!nights ? <span className={styles.reservePer}> / {unitLabel}</span> : null}
          </span>
          <span className={styles.reserveDates}>
            {stayLabel || (isParty ? `${chosen?.label ?? 'Party'} · pick a date` : 'Add dates to see the total')}
          </span>
          <span className={styles.reserveChip}>
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {suggested
              ? 'Suggested · change'
              : nights
                ? isParty
                  ? 'Change date'
                  : 'Change dates'
                : isParty
                  ? 'Pick a date'
                  : 'Pick dates'}
          </span>
        </button>
        {nights ? (
          <button
            type="submit"
            form="book-form"
            className={styles.reserveButton}
            disabled={busy || quoting}
            aria-busy={busy || undefined}
            onClick={() => navigator.vibrate?.(10)}
          >
            {busy ? <span className={styles.reserveSpinner} aria-hidden="true" /> : null}
            {busy ? 'Reserving' : 'Reserve'}
          </button>
        ) : (
          <button type="button" className={styles.reserveButton} onClick={openSheet} aria-haspopup="dialog">
            {isParty ? 'Pick a date' : 'Check dates'}
          </button>
        )}
      </div>
    </aside>
  );
}
