import { Suspense } from 'react';
import { RegisterForm } from '@/app/(auth)/auth/auth-forms';
import { Spinner } from '@/components/ui/feedback';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Create account',
  path: '/auth/register',
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <Suspense fallback={<Spinner label="Loading registration" />}>
      <RegisterForm />
    </Suspense>
  );
}
