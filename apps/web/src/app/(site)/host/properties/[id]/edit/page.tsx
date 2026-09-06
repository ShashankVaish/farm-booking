import { ListingWizard } from '../../../listing-wizard';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Edit listing',
  path: '/host/properties',
  noIndex: true,
});

type Props = { params: Promise<{ id: string }> };

export default async function EditPropertyPage({ params }: Props) {
  const { id } = await params;
  return <ListingWizard propertyId={id} />;
}
