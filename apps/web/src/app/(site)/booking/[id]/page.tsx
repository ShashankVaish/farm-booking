import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return buildPageMetadata({
    title: 'Booking',
    path: `/booking/${id}`,
    noIndex: true,
  });
}

export default async function BookingPage({ params }: Props) {
  const { id } = await params;
  return (
    <RoutePlaceholder
      title="Booking"
      description={`Checkout for booking “${id}” is reserved for a later phase. Dates, guests, and payment will not be collected here yet.`}
    />
  );
}
