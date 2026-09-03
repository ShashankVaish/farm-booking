import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Dashboard',
  path: '/dashboard',
  noIndex: true,
});

export default function DashboardPage() {
  return (
    <RoutePlaceholder
      title="Account"
      description="Customer trips, profile, and saved stays will live under /dashboard. This is a routing placeholder only."
    />
  );
}
