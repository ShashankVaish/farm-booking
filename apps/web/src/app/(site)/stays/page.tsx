import { redirect } from 'next/navigation';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Stays',
  path: '/stays',
  description: 'Overnight farmhouses and villas for family weekends and private getaways.',
});

export default function StaysPage() {
  redirect('/explore');
}
