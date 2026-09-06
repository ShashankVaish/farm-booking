'use client';

import { ErrorState } from '@/components/ui/feedback';
import { SiteShell } from '@/components/layout/site-shell';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <SiteShell>
      <ErrorState title="This page could not load" description="Please try again." onRetry={reset} />
    </SiteShell>
  );
}
