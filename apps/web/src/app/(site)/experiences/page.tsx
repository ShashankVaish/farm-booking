import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Experiences',
  path: '/experiences',
});

export default function ExperiencesPage() {
  return (
    <RoutePlaceholder
      title="Experiences"
      description="Hosted celebrations and on-property experiences will be added in a later phase."
    />
  );
}
