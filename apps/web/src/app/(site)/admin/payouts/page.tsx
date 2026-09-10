import { PayoutsPanel } from '@/components/admin/payouts-panel';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Host payouts',
  path: '/admin/payouts',
  noIndex: true,
});

export default function AdminPayoutsPage() {
  return <PayoutsPanel />;
}
