/*
  Reconciles the uploads folder against the database, in both directions.

  Two different things go wrong here and they need opposite fixes:

  - ORPHAN FILES sit on disk with nothing pointing at them — a host removed a
    photo, or replaced one, or abandoned a draft listing. They are dead weight
    and safe to delete.
  - DANGLING REFERENCES are rows pointing at a file that is no longer on disk.
    Deleting those is a data change, not a cleanup, so this script only reports
    them. They are what makes a gallery render "Photo unavailable".

  Dry run by default. Nothing is deleted without --apply.

    node scripts/clean-uploads.mjs           # report only
    node scripts/clean-uploads.mjs --apply   # delete orphan files
*/
import { readdir, stat, unlink, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { PrismaClient } from '@prisma/client';

// The API reads config from the repo-root .env; mirror that here.
const envPath = resolve(process.cwd(), '../../.env');
if (existsSync(envPath)) {
  for (const line of (await readFile(envPath, 'utf8')).split('\n')) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const at = text.indexOf('=');
    if (at < 1) continue;
    const key = text.slice(0, at).trim();
    let value = text.slice(at + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const APPLY = process.argv.includes('--apply');
const UPLOADS = join(process.cwd(), 'uploads');
const prisma = new PrismaClient();

/** Reduces any stored form — full URL, "/uploads/x.jpg", bare name — to a filename. */
function toFilename(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  // Ignore anything hosted elsewhere; only local uploads are managed here.
  if (/^https?:\/\//i.test(text) && !text.includes('/uploads/')) return null;
  const withoutQuery = text.split('?')[0].split('#')[0];
  return basename(withoutQuery) || null;
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Every filename any row points at, with what points at it. */
async function referencedFiles() {
  const map = new Map();
  const add = (value, label) => {
    const name = toFilename(value);
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(label);
  };

  for (const row of await prisma.propertyImage.findMany({
    select: { url: true, property: { select: { title: true } } },
  })) {
    add(row.url, `photo · ${row.property?.title ?? 'unknown listing'}`);
  }

  for (const row of await prisma.ownerProfile.findMany({
    select: { panImageUrl: true, aadhaarImageUrl: true, userId: true },
  })) {
    add(row.panImageUrl, `KYC PAN · owner ${row.userId.slice(0, 8)}`);
    add(row.aadhaarImageUrl, `KYC Aadhaar · owner ${row.userId.slice(0, 8)}`);
  }

  for (const row of await prisma.propertyDocument.findMany({
    select: { url: true, name: true },
  })) {
    add(row.url, `document · ${row.name}`);
  }

  return map;
}

async function main() {
  const referenced = await referencedFiles();

  let files = [];
  try {
    files = await readdir(UPLOADS);
  } catch {
    console.log(`No uploads directory at ${UPLOADS}.`);
  }

  const orphans = [];
  let keptBytes = 0;
  let orphanBytes = 0;

  for (const name of files) {
    const path = join(UPLOADS, name);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) continue;
    if (referenced.has(name)) {
      keptBytes += info.size;
    } else {
      orphans.push({ name, size: info.size });
      orphanBytes += info.size;
    }
  }

  const dangling = [...referenced.entries()].filter(
    ([name]) => !files.includes(name),
  );

  console.log(`Uploads directory : ${UPLOADS}`);
  console.log(`Files on disk     : ${files.length}`);
  console.log(`Referenced by DB  : ${referenced.size}`);
  console.log(
    `In use, kept      : ${files.length - orphans.length} (${human(keptBytes)})`,
  );
  console.log(`Orphaned files    : ${orphans.length} (${human(orphanBytes)})`);
  console.log(`Dangling refs     : ${dangling.length}`);

  if (orphans.length > 0) {
    console.log('\nOrphaned files (nothing in the database points at these):');
    for (const item of orphans) {
      console.log(`  ${item.name}  ${human(item.size)}`);
    }
  }

  if (dangling.length > 0) {
    console.log('\nDangling references (row points at a file that is gone):');
    for (const [name, owners] of dangling) {
      console.log(`  ${name}`);
      for (const owner of owners) console.log(`      ← ${owner}`);
    }
    console.log(
      '\n  These are why a gallery shows "Photo unavailable". Re-upload the\n  images, or clear the rows — this script will not touch them, because\n  removing them is a data change rather than a cleanup.',
    );
  }

  if (orphans.length === 0) {
    console.log('\nNothing to delete — every file on disk is in use.');
    return;
  }

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to delete ${orphans.length} file(s).`);
    return;
  }

  let removed = 0;
  for (const item of orphans) {
    await unlink(join(UPLOADS, item.name));
    removed += 1;
  }
  console.log(`\nDeleted ${removed} orphaned file(s), freeing ${human(orphanBytes)}.`);
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
