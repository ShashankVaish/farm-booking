import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Admin',
  path: '/admin',
  noIndex: true,
});

export default function AdminPage() {
  return (
    <RoutePlaceholder
      title="Admin"
      description="Moderation and operations tools will use /admin. No admin functionality is implemented in this phase."
    />
  );
}
