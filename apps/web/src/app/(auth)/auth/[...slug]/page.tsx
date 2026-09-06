import { RoutePlaceholder } from '@/components/layout/route-placeholder';

type Props = { params: Promise<{ slug: string[] }> };

export default async function AuthCatchAllPage({ params }: Props) {
  const { slug } = await params;
  return (
    <RoutePlaceholder
      title="Account"
      description={`Auth route /auth/${slug.join('/')} is reserved for a later phase.`}
    />
  );
}
