import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { NearbyMap } from '@/components/hospitality/nearby-map';

export const metadata = buildPageMetadata({
  title: 'Map view',
  path: '/map',
  description: 'Every approved farmhouse and villa on a map of India. Share your location to see stays within 10 km.',
});

export default function MapPage() {
  return (
    <section className="container" style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <p className="t-label">Map view</p>
      <h1 className="t-h1">Stays on the map</h1>
      <p className="t-body-small" style={{ marginTop: 'var(--space-3)', maxWidth: '42rem' }}>
        Every approved stay, across India. Tap <strong>Near me</strong> to narrow it to properties within 10 km — your
        location is used only in this browser session and never stored.
      </p>
      <NearbyMap />
    </section>
  );
}
