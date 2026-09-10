import { Suspense } from 'react';
import { RegisterForm } from '@/app/(auth)/auth/auth-forms';
import { AuthFormSkeleton } from '@/app/(auth)/auth/auth-chrome';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Create account',
  path: '/auth/register',
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton fields={4} />}>
      <RegisterForm />
    </Suspense>
  );
}
