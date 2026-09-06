import { Suspense } from 'react';
import { LoginForm } from '@/app/(auth)/auth/auth-forms';
import { Spinner } from '@/components/ui/feedback';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Sign in',
  path: '/auth/login',
  noIndex: true,
});

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner label="Loading sign in" />}>
      <LoginForm />
    </Suspense>
  );
}
