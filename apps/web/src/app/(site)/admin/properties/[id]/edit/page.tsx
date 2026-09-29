import { ListingWizard } from '@/app/(site)/host/listing-wizard';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Edit listing',
  path: '/admin/properties',
  noIndex: true,
});

type Props = { params: Promise<{ id: string }> };

/*
  Admins edit any host's listing here, inside the admin panel. The same wizard
  the host uses, in admin mode: details only, no identity or agreement steps,
  and the listing keeps its status. The API audits the edit and notifies the host.
*/
export default async function AdminEditPropertyPage({ params }: Props) {
  const { id } = await params;
  return <ListingWizard propertyId={id} mode="admin" />;
}
