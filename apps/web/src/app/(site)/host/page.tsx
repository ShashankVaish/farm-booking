import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Host',
  path: '/host',
  noIndex: true,
});

export default function HostPage() {
  return (
    <RoutePlaceholder
      title="List your property"
      description="The owner portal will live under /host. Listing creation, calendars, and payouts are out of scope for this phase."
    />
  );
}
