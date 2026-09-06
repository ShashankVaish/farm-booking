import { ListingWizard } from '../../listing-wizard';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'New listing',
  path: '/host/properties/new',
  noIndex: true,
});

export default function NewPropertyPage() {
  return <ListingWizard />;
}
