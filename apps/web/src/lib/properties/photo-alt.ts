/*
  Uploads keep the original filename as their alt text. Real rows in this
  database look like "IMAGE 2025-06-12 AT 21.12.54_30A7A4D5", "sign", "sign1",
  "sign (1)" and "photo". Two things went wrong with using that verbatim: a
  screen reader read the filename out as the photo's description, and the
  gallery printed it across the hero whenever the file was missing from disk,
  which made one absent photo look like a broken page.

  Anything that looks like a filename is replaced with a real description.
  Genuine host-written alt text is left alone.
*/

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff?)$/i;

/** How phones and messengers name what they save. */
const CAMERA_PREFIX =
  /^(img|image|dsc|dscn|pxl|photo|screenshot|whatsapp|signal|snapchat|inshot|vid)[\s_-]/i;

/** Browsers append this when a name is already taken: "sign (1)". */
const DUPLICATE_SUFFIX = /\s*\(\d+\)$/;

function looksLikeFilename(text: string): boolean {
  if (CAMERA_PREFIX.test(text) || IMAGE_EXTENSION.test(text)) return true;
  // A single bare token — "sign", "sign1", "photo", "IMG_2043" — is a filename,
  // not a description. Alt text worth keeping is prose, and prose has spaces.
  const bare = text.replace(IMAGE_EXTENSION, '').replace(DUPLICATE_SUFFIX, '').trim();
  return !bare.includes(' ');
}

export function photoAlt(raw: string | null | undefined, title: string, position: number): string {
  const text = (raw ?? '').trim();
  if (!text || looksLikeFilename(text)) return `${title} — photo ${position}`;
  return text;
}
