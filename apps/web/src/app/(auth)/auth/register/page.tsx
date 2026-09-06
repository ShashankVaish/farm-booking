import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Create account',
  path: '/auth/register',
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <RoutePlaceholder
      title="Create account"
      description="Registration UI is deferred. The API already supports customer and owner registration."
    />
  );
}
