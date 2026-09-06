import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Stays',
  path: '/stays',
});

export default function StaysPage() {
  return (
    <RoutePlaceholder
      title="Stays"
      description="Overnight farmhouses and villas will be listed here. This route exists to lock navigation architecture."
    />
  );
}
