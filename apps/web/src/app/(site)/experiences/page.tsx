import { redirect } from 'next/navigation';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Experiences',
  path: '/experiences',
  description: 'Weekend stays and private farmhouse experiences across India.',
});

export default function ExperiencesPage() {
  redirect('/explore?propertyType=WEEKEND_STAY');
}
