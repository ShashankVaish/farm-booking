import { TermsDocumentView } from '@/components/legal/terms-document';
import { SHIPPING_AND_RETURNS } from '@/lib/legal/policies-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

/*
  Payment providers require a shipping policy and a return policy URL before
  onboarding a merchant, and their forms do not always offer a "not applicable"
  box. This page is what those two fields point at.
*/
export const metadata = buildPageMetadata({
  title: SHIPPING_AND_RETURNS.title,
  description: SHIPPING_AND_RETURNS.subtitle,
  path: '/shipping-and-returns',
});

export default function ShippingAndReturnsPage() {
  return (
    <TermsDocumentView
      document={SHIPPING_AND_RETURNS}
      counterpart={{ href: '/refund-policy', label: 'Cancellations are covered by the Refund Policy →' }}
    />
  );
}
