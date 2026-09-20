import { TermsDocumentView } from '@/components/legal/terms-document';
import { PRIVACY_POLICY } from '@/lib/legal/policies-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: PRIVACY_POLICY.title,
  description: PRIVACY_POLICY.subtitle,
  path: '/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <TermsDocumentView
      document={PRIVACY_POLICY}
      counterpart={{ href: '/refund-policy', label: 'Cancelling a stay? Read the Refund Policy →' }}
    />
  );
}
