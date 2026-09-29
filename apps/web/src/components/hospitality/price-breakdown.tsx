import type { PriceQuote } from '@/lib/bookings/types';
import { SLOT_LABEL } from '@/lib/bookings/slots';
import styles from './hospitality.module.css';

function rupees(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function PriceBreakdown({ quote, disclaimer = true }: { quote: PriceQuote; disclaimer?: boolean }) {
  // A day or night party is one date at one price: a single line, whether it
  // came from the host's party price or that date's night rate.
  const party = quote.slot && quote.slot !== 'OVERNIGHT' ? SLOT_LABEL[quote.slot] : null;
  return (
    <div className="t-body-small">
      {party ? (
        <p className={styles.priceRow}>
          <span>
            {party}
            {quote.slot === 'DAY' && !quote.slotPriced
              ? ' (same as night party)'
              : !quote.slotPriced && Number(quote.weekendAmount) > 0
                ? ' (weekend)'
                : ''}
          </span>
          <span>{rupees(Number(quote.baseAmount) + Number(quote.weekendAmount))}</span>
        </p>
      ) : (
        <>
          <p className={styles.priceRow}>
            <span>Base stay ({quote.weekdayNights ?? quote.nights} weekday night{quote.nights === 1 ? '' : 's'})</span>
            <span>{rupees(quote.baseAmount)}</span>
          </p>
          <p className={styles.priceRow}>
            <span>Weekend charges</span>
            <span>{rupees(quote.weekendAmount)}</span>
          </p>
        </>
      )}
      <p className={styles.priceRow}>
        <span>Extra guest charges</span>
        <span>{rupees(quote.extraGuestAmount)}</span>
      </p>
      <p className={styles.priceRow}>
        <span>Taxes / platform fee</span>
        <span>{rupees(quote.platformFee)}</span>
      </p>
      <p className={styles.priceRow}>
        <span>Coupon discount</span>
        <span>− {rupees(quote.discountAmount)}</span>
      </p>
      <p className={`${styles.priceTotal} t-price`}>
        <span>Total</span>
        <span>{rupees(quote.totalAmount)}</span>
      </p>
      {disclaimer ? (
        <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
          This total is informational. The server calculates the amount charged at payment.
        </p>
      ) : null}
    </div>
  );
}
