import { redirect } from 'next/navigation';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Events',
  path: '/events',
  description: 'Party houses and event venues for birthdays, sangeets, and gatherings.',
});

export default function EventsPage() {
  redirect('/explore?partyAllowed=true');
}
