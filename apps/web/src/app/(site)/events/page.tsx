import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Events',
  path: '/events',
});

export default function EventsPage() {
  return (
    <RoutePlaceholder
      title="Events"
      description="Venues for birthdays, pre-wedding gatherings, and corporate events will use this route."
    />
  );
}
