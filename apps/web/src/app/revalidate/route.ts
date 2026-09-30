import { timingSafeEqual } from 'crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { PROPERTIES_TAG } from '@/lib/properties/api';

/*
  Called by the API after any change to listing data (an edit, a moderation,
  a booking, a review). Drops every cached page and fetch built from listing
  data so the next visitor gets a fresh one. Protected by REVALIDATE_SECRET,
  which the API sends in a header; without a matching secret nothing happens.
*/

function secretMatches(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get('x-revalidate-secret'))) {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }
  revalidateTag(PROPERTIES_TAG);
  // The homepage and explore are built from the same data.
  revalidatePath('/');
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
