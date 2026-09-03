import { Button } from '@/components/ui/button';
import { brand } from '@/lib/config/brand';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <section className={`container ${styles.hero}`}>
      <p className="t-label">Private stays · India</p>
      <h1 className="t-display">{brand.tagline}</h1>
      <p className={`t-body ${styles.lead}`}>
        Farmhouses, villas, and party houses for birthdays, pool gatherings, and family celebrations. This
        release establishes the product shell and design language. Discovery, maps, and booking arrive next.
      </p>
      <div className={styles.actions}>
        <Button href="/explore">Find a Stay</Button>
        <Button href="/design-system" variant="secondary">
          View design foundation
        </Button>
      </div>
    </section>
  );
}
