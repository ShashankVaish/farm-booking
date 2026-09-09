import { BookingExperience } from '@/components/booking/booking-experience';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return buildPageMetadata({
    title: 'Booking confirmation',
    path: `/booking/${id}/confirmation`,
    noIndex: true,
  });
}

export default async function ConfirmationPage({ params }: Props) {
  const { id } = await params;
  return (
    <section className="container" style={{ padding: 'var(--space-10) 0 var(--space-16)' }}>
      <BookingExperience bookingId={id} confirmation />
    </section>
  );
}
