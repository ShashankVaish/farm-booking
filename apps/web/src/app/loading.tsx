import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return (
    <div className="container" style={{ padding: '3rem 0', display: 'grid', gap: '1rem' }}>
      <Skeleton height="2rem" width="40%" />
      <Skeleton height="8rem" />
      <Skeleton height="8rem" />
    </div>
  );
}
