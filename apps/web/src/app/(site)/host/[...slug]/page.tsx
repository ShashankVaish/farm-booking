import { RoutePlaceholder } from '@/components/layout/route-placeholder';

type Props = { params: Promise<{ slug: string[] }> };

export default async function HostCatchAllPage({ params }: Props) {
  const { slug } = await params;
  return (
    <RoutePlaceholder
      title="Host"
      description={`Owner tools under /host/${slug.join('/')} will be added later.`}
    />
  );
}
