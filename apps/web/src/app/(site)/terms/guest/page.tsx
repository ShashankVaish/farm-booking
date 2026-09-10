import { TermsDocumentView } from '@/components/legal/terms-document';
import { GUEST_TERMS } from '@/lib/legal/terms-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: GUEST_TERMS.title,
  description: GUEST_TERMS.subtitle,
  path: '/terms/guest',
});

export default function GuestTermsPage() {
  return (
    <TermsDocumentView
      document={GUEST_TERMS}
      counterpart={{ href: '/terms/host', label: 'Listing a property? Read the Host Terms →' }}
    />
  );
}
