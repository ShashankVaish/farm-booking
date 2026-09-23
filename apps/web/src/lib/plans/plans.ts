import { brand } from '@/lib/config/brand';

export type SubscriptionPlan = {
  id: string;
  name: string;
  description?: string | null;
  monthlyPrice: string | number;
  // null means unlimited listings.
  listingLimit: number | null;
  features: string[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function formatMonthlyPrice(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function listingLimitLabel(limit: number | null) {
  if (limit == null) return 'Unlimited listings';
  return limit === 1 ? '1 listing' : `${limit} listings`;
}

// The admin types features one per line; blank lines are dropped.
export function parseFeatureLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/*
  Subscribing is handled by the team for now, so choosing a plan opens an email
  to support with the plan named in the subject rather than starting a payment.
*/
export function planEnquiryHref(planName: string) {
  const subject = `Subscribe to the ${planName} plan`;
  const body = `Hi, I'd like to subscribe to the ${planName} monthly plan for listing my property.`;
  return `${brand.support.emailHref}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
