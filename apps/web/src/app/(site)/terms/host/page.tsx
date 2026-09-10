import { TermsDocumentView } from '@/components/legal/terms-document';
import { HOST_TERMS } from '@/lib/legal/terms-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: HOST_TERMS.title,
  description: HOST_TERMS.subtitle,
  path: '/terms/host',
});

export default function HostTermsPage() {
  return (
    <TermsDocumentView
      document={HOST_TERMS}
      counterpart={{ href: '/terms/guest', label: 'Booking a stay? Read the Guest Terms →' }}
    />
  );
}
