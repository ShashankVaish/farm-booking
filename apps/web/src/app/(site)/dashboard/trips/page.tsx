import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Trips',
  path: '/dashboard/trips',
  noIndex: true,
});

export default function TripsPage() {
  return (
    <RoutePlaceholder
      title="Trips"
      description="Upcoming and past bookings will appear here in a later phase."
    />
  );
}
