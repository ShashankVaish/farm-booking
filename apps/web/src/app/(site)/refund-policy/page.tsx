import { TermsDocumentView } from '@/components/legal/terms-document';
import { REFUND_POLICY } from '@/lib/legal/policies-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: REFUND_POLICY.title,
  description: REFUND_POLICY.subtitle,
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <TermsDocumentView
      document={REFUND_POLICY}
      counterpart={{ href: '/terms/guest', label: 'The full Guest Terms & Conditions →' }}
    />
  );
}
