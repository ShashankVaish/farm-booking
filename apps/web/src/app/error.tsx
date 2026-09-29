'use client';

import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/feedback';
import { SiteShell } from '@/components/layout/site-shell';
import { MaintenanceScreen } from '@/components/maintenance/maintenance-screen';
import { checkApiHealth } from '@/lib/api/availability';

/*
  A page failed to render. If the reason is that the backend is down, the
  visitor sees the maintenance screen rather than a generic error.

  The error itself cannot say so: in production Next replaces a server error's
  name and message with a generic one before it reaches the browser. So this
  asks the API's health route directly and decides from that.
*/
export default function ErrorPage({ reset }: { reset: () => void }) {
  const [serverDown, setServerDown] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkApiHealth().then((healthy) => {
      if (!cancelled) setServerDown(!healthy);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (serverDown) {
    return <MaintenanceScreen force />;
  }

  return (
    <SiteShell>
      {serverDown === null ? null : (
        <ErrorState title="This page could not load" description="Please try again." onRetry={reset} />
      )}
    </SiteShell>
  );
}
