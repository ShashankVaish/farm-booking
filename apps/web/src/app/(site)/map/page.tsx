import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { NearbyMap } from '@/components/hospitality/nearby-map';

export const metadata = buildPageMetadata({
  title: 'Nearby stays',
  path: '/map',
  description: 'Find approved farmhouses and villas within 10 km of your location.',
});

export default function MapPage() {
  return (
    <section className="container" style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <p className="t-label">Map view</p>
      <h1 className="t-h1">Stays near you</h1>
      <p className="t-body-small" style={{ marginTop: 'var(--space-3)', maxWidth: '42rem' }}>
        Allow location access to see approved properties within 10 km. Your location is used only in this browser session.
      </p>
      <NearbyMap />
    </section>
  );
}
