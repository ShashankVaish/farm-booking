import { Suspense } from 'react';
import { LoginForm } from '@/app/(auth)/auth/auth-forms';
import { AuthFormSkeleton } from '@/app/(auth)/auth/auth-chrome';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Sign in',
  path: '/auth/login',
  noIndex: true,
});

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton fields={2} />}>
      <LoginForm />
    </Suspense>
  );
}
