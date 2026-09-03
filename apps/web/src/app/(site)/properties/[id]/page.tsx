import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return buildPageMetadata({
    title: 'Property',
    path: `/properties/${id}`,
  });
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  return (
    <RoutePlaceholder
      title="Property"
      description={`Property detail for “${id}” will include gallery, amenities, availability, and booking. Only the route exists in this phase.`}
    />
  );
}
