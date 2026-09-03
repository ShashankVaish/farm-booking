import { EmptyState } from '@/components/ui/feedback';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Wishlist',
  path: '/dashboard/wishlist',
  noIndex: true,
});

export default function WishlistPage() {
  return (
    <section className="container" style={{ padding: '4rem 0' }}>
      <EmptyState
        title="No saved stays yet"
        description="Wishlist behaviour will connect to the API later. This empty state is the reusable foundation."
        actionHref="/explore"
        actionLabel="Browse stays"
      />
    </section>
  );
}
