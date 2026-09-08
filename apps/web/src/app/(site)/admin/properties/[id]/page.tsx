import { PropertyReview } from '@/components/admin/property-review';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Listing verification',
  path: '/admin/properties',
  noIndex: true,
});

type Props = { params: Promise<{ id: string }> };

export default async function AdminPropertyDetailPage({ params }: Props) {
  const { id } = await params;
  return <PropertyReview propertyId={id} />;
}
