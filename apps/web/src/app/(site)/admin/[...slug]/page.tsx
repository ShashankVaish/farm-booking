import { RoutePlaceholder } from '@/components/layout/route-placeholder';

type Props = { params: Promise<{ slug: string[] }> };

export default async function AdminCatchAllPage({ params }: Props) {
  const { slug } = await params;
  return (
    <RoutePlaceholder
      title="Admin"
      description={`Operations screens under /admin/${slug.join('/')} will be added later.`}
    />
  );
}
