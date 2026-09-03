import { EmptyState } from '@/components/ui/feedback';
import { SiteShell } from '@/components/layout/site-shell';

export default function NotFound() {
  return (
    <SiteShell>
      <EmptyState
        title="Page not found"
        description="This address is not part of the current site."
        actionHref="/"
        actionLabel="Go home"
      />
    </SiteShell>
  );
}
