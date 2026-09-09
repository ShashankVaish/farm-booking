import { BookingDetail } from '@/components/admin/booking-detail';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Booking',
  path: '/admin/bookings',
  noIndex: true,
});

type Props = { params: Promise<{ id: string }> };

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params;
  return <BookingDetail bookingId={id} />;
}
