import { WishlistView } from '@/components/hospitality/wishlist-view';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Wishlist',
  path: '/dashboard/wishlist',
  noIndex: true,
});

export default function WishlistPage() {
  return (
    <section className="container" style={{ padding: 'var(--space-10) 0' }}>
      <p className="t-label">Account</p>
      <h1 className="t-h1">Saved stays</h1>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <WishlistView />
      </div>
    </section>
  );
}
