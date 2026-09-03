import { RoutePlaceholder } from '@/components/layout/route-placeholder';

type Props = { params: Promise<{ slug: string[] }> };

export default async function DashboardCatchAllPage({ params }: Props) {
  const { slug } = await params;
  return (
    <RoutePlaceholder
      title="Dashboard"
      description={`Customer account route /dashboard/${slug.join('/')} is reserved for a later phase.`}
    />
  );
}
