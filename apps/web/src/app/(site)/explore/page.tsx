import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Explore',
  path: '/explore',
  description: 'Browse private farmhouses, villas, and party venues. Search arrives in a later phase.',
});

export default function ExplorePage() {
  return (
    <RoutePlaceholder
      title="Explore"
      description="Property search, filters, and map discovery will live here. The routing and navigation are in place so later phases can fill this surface without restructuring the app."
    />
  );
}
