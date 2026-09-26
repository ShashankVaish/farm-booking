import styles from '@/components/hospitality/hospitality.module.css';

/*
  Shown the instant Search is pressed.

  Without a loading boundary on this segment, Next kept the home page on screen
  (the button stuck on "Searching…") until the whole Explore page had rendered
  on the server. The site-wide app/loading.tsx sits above the shared (site)
  layout, so it never applied to a move from Home to Explore. With this, the
  page switches immediately and the results fill in when they arrive.
*/
export default function ExploreLoading() {
  return (
    <section
      className="container"
      style={{ padding: 'var(--space-8) 0 var(--space-16)' }}
      aria-busy="true"
      aria-label="Loading stays"
    >
      <p className="t-label">Explore</p>
      <h1 className="t-h1">Find a private stay</h1>
      <div className="skeleton" style={{ height: '3.25rem', marginTop: 'var(--space-6)', borderRadius: 'var(--radius-md)' }} />
      <p className="t-body-small" role="status" style={{ marginTop: 'var(--space-5)', color: 'var(--color-text-muted)' }}>
        Finding stays…
      </p>
      <div className={styles.grid} style={{ marginTop: 'var(--space-5)' }}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.card} aria-hidden="true">
            <div className="skeleton" style={{ aspectRatio: '5 / 4' }} />
            <div style={{ display: 'grid', gap: 'var(--space-2)', padding: 'var(--space-4) var(--space-1) var(--space-2)' }}>
              <div className="skeleton" style={{ height: '0.75rem', width: '35%' }} />
              <div className="skeleton" style={{ height: '1.1rem', width: '80%' }} />
              <div className="skeleton" style={{ height: '0.85rem', width: '60%' }} />
              <div className="skeleton" style={{ height: '1.25rem', width: '40%', marginTop: 'var(--space-2)' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
