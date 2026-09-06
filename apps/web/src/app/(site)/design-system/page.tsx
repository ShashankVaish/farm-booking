import { OverlayPlayground } from '@/components/design-system/overlay-playground';
import {
  BookingCardFoundation,
  DatePickerFoundation,
  GuestSelector,
  ImageGalleryFoundation,
  SearchBox,
} from '@/components/hospitality/foundations';
import { PropertyGrid } from '@/components/hospitality/property-card';
import { Avatar, Badge, Card, Divider } from '@/components/ui/content';
import { Tabs } from '@/components/ui/disclosure';
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Radio, Select, Textarea } from '@/components/ui/forms';
import { Switch } from '@/components/ui/switch';
import { demoProperties } from '@/data/demo-properties';
import { colorTokens } from '@/lib/config/tokens';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import styles from './design-system.module.css';

export const metadata = buildPageMetadata({
  title: 'Design foundation',
  path: '/design-system',
  noIndex: true,
  description: 'Internal visual language, tokens, and reusable components.',
});

const COLOR_VALUES: Record<(typeof colorTokens)[number], string> = {
  background: 'var(--color-background)',
  surface: 'var(--color-surface)',
  'surface-elevated': 'var(--color-surface-elevated)',
  'text-primary': 'var(--color-text-primary)',
  'text-secondary': 'var(--color-text-secondary)',
  'text-muted': 'var(--color-text-muted)',
  border: 'var(--color-border)',
  primary: 'var(--color-primary)',
  'primary-hover': 'var(--color-primary-hover)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
};

export default function DesignSystemPage() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.intro}>
        <p className="t-label">Internal</p>
        <h1 className="t-h1">Design foundation</h1>
        <p className="t-body">
          Tokens, type, and components for a hospitality marketplace. Brand name and palette can change without
          restructuring screens.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className="t-h2">Colour</h2>
        <div className={styles.swatches}>
          {colorTokens.map((token) => (
            <div key={token} className={styles.swatch}>
              <div className={styles.chip} style={{ background: COLOR_VALUES[token] }} />
              <p className="t-caption">{token}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Typography</h2>
        <div className={styles.typeSample}>
          <p className="t-display">Private gathering</p>
          <h3 className="t-h1">A house with a lawn and a pool</h3>
          <h3 className="t-h2">Weekend in Alibaug</h3>
          <h3 className="t-h3">Pool house</h3>
          <h3 className="t-h4">Guest details</h3>
          <p className="t-body">Body copy for descriptions, house rules, and celebration notes.</p>
          <p className="t-body-small">Secondary copy for locations and capacity.</p>
          <p className="t-label">Section label</p>
          <p className="t-caption">Caption and helper text</p>
          <p className="t-price">₹28,000</p>
          <p className="t-metadata">Farmhouse</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Actions</h2>
        <div className={styles.row}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Forms</h2>
        <div className={styles.stack}>
          <Input id="ds-name" label="Full name" placeholder="Ananya Sharma" />
          <Textarea id="ds-notes" label="Notes" placeholder="Occasion, guest count, timing" />
          <Select id="ds-city" label="City">
            <option>Lonavala</option>
            <option>Alibaug</option>
            <option>Udaipur</option>
          </Select>
          <Checkbox id="ds-check" label="This stay is for a private event" />
          <Radio id="ds-radio" name="occasion" label="Birthday" defaultChecked />
          <Switch label="Show pool properties first" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Feedback</h2>
        <div className={styles.row}>
          <Badge>Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="solid">Solid</Badge>
          <Avatar name="Ananya Sharma" />
          <Spinner />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Skeleton height="4.5rem" />
        </div>
        <Divider />
        <EmptyState title="Nothing here yet" description="Reusable empty copy for lists and wishlists." />
        <ErrorState title="Network error" description="Reusable error copy when the API cannot be reached." />
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Overlays</h2>
        <OverlayPlayground />
        <div style={{ marginTop: '1.5rem' }}>
          <Tabs
            tabs={[
              { id: 'stay', label: 'Stay', panel: <p className="t-body-small">Overnight booking later.</p> },
              { id: 'event', label: 'Event', panel: <p className="t-body-small">Day events later.</p> },
            ]}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Search and booking foundations</h2>
        <SearchBox />
        <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }} className={styles.gallery}>
          <Card>
            <GuestSelector />
          </Card>
          <Card>
            <DatePickerFoundation />
          </Card>
          <BookingCardFoundation price={28000} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Gallery foundation</h2>
        <div className={styles.gallery}>
          <ImageGalleryFoundation
            images={[
              { alt: 'Lawn', tone: 'lawn' },
              { alt: 'Pool', tone: 'pool' },
              { alt: 'Evening', tone: 'night' },
              { alt: 'Interior', tone: 'default' },
            ]}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="t-h2">Property cards</h2>
        <PropertyGrid properties={demoProperties} />
      </section>
    </div>
  );
}
