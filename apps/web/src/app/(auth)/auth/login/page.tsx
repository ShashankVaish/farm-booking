import { RoutePlaceholder } from '@/components/layout/route-placeholder';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Sign in',
  path: '/auth/login',
  noIndex: true,
});

export default function LoginPage() {
  return (
    <RoutePlaceholder
      title="Sign in"
      description="Authentication screens will connect to the NestJS auth API later. This route exists so account links have a destination."
    />
  );
}
