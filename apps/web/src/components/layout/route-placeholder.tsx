import { Button } from '@/components/ui/button';
import styles from './shell.module.css';

export function RoutePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={`container ${styles.placeholder}`}>
      <p className="t-label">Coming later</p>
      <h1 className="t-h1">{title}</h1>
      <p className="t-body">{description}</p>
      <div style={{ marginTop: '1.5rem' }}>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </section>
  );
}
