/*
  Sample data for local development: two hosts, a guest, and a set of
  approved listings with placeholder photos, amenities and a few blocked dates.

    npm run db:seed:dev            # create or refresh the sample data
    npm run db:seed:dev -- --reset # remove only the sample data

  DEVELOPMENT ONLY. Three separate things keep this away from production:

    1. It lives in apps/api/scripts, which the API Dockerfile never copies, so
       it does not exist inside the production image.
    2. It refuses to run when NODE_ENV is "production".
    3. It refuses to run unless DATABASE_URL points at this machine
       (localhost / 127.0.0.1 / ::1). The production database is reached by
       the Docker service name "postgres", which is refused.

  Everything it creates is recognisable and removable: users have
  @dev.baagly.test emails, listings have slugs starting with "dev-", and the
  photos are PNG placeholders in uploads/dev-seed/. Running it again updates
  the same rows rather than duplicating them.
*/
import { PrismaClient, PropertyType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';

const EMAIL_DOMAIN = 'dev.baagly.test';
const SLUG_PREFIX = 'dev-';
const PASSWORD = 'DevPass123!';
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'dev-seed');

// --- Safety -------------------------------------------------------------------

function assertDevelopmentDatabase(): void {
  const env = (process.env.NODE_ENV ?? 'development').toLowerCase();
  if (env === 'production') {
    fail('NODE_ENV is "production". The dev seed never runs in production.');
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) fail('DATABASE_URL is not set.');
  let host: string;
  try {
    host = new URL(raw).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    fail('DATABASE_URL is not a valid URL.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    fail(
      `DATABASE_URL points at "${host}", not this machine. The dev seed only runs against a local database.`,
    );
  }
}

function fail(message: string): never {
  console.error(`\n[dev-seed] Refusing to run: ${message}\n`);
  process.exit(1);
}

// --- Sample content -------------------------------------------------------------

type Tone = 'pool' | 'lawn' | 'night' | 'desert' | 'beach' | 'hills';

type SampleListing = {
  slug: string;
  host: 'meera' | 'arjun';
  title: string;
  type: PropertyType;
  city: string;
  state: string;
  location: string;
  pincode: string;
  lat: number;
  lng: number;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  weekend?: number;
  extraGuest?: number;
  party?: boolean;
  couple?: boolean;
  adultOnly?: boolean;
  trusted?: boolean;
  tone: Tone;
  amenities: string[];
  description: string;
};

const HOSTS = {
  meera: {
    name: 'Meera Kapoor (Dev Host)',
    phone: '9000000001',
    business: 'Kapoor Stays',
  },
  arjun: {
    name: 'Arjun Mehta (Dev Host)',
    phone: '9000000002',
    business: 'Mehta Farms',
  },
} as const;

const GUEST = { name: 'Asha Rao (Dev Guest)', phone: '9000000003' };

const AMENITIES = [
  'Private pool',
  'Lawn',
  'Wi-Fi',
  'Parking',
  'Barbecue',
  'Music system',
  'Jacuzzi',
  'Kitchen',
  'Air conditioning',
  'Projector',
  'Bonfire',
  'Caretaker',
];

const HOUSE_RULES =
  'Check-in from 1 pm, check-out by 11 am. Carry a government ID for every adult guest. No smoking indoors. Please respect the neighbours after 10 pm.';
const PARTY_RULES =
  'Music allowed until 10 pm outdoors and midnight indoors. Decorations are welcome but no confetti cannons or open flames near the pool.';
const CANCELLATION =
  'Full refund if cancelled 7 days before check-in. 50% refund if cancelled 3 to 7 days before. No refund within 3 days of check-in.';

const LISTINGS: SampleListing[] = [
  {
    slug: 'dev-lonavala-lake-view-farmhouse',
    host: 'meera',
    title: 'Lake View Farmhouse with Private Pool',
    type: 'FARMHOUSE',
    city: 'Lonavala',
    state: 'Maharashtra',
    location: 'Tungarli, Lonavala',
    pincode: '410403',
    lat: 18.7546,
    lng: 73.4062,
    guests: 12,
    bedrooms: 4,
    bathrooms: 4,
    price: 14500,
    weekend: 18500,
    extraGuest: 800,
    party: true,
    trusted: true,
    tone: 'pool',
    amenities: [
      'Private pool',
      'Lawn',
      'Wi-Fi',
      'Parking',
      'Barbecue',
      'Music system',
      'Caretaker',
    ],
    description:
      'A four-bedroom farmhouse above Tungarli lake with a private pool, a wide lawn for evening gatherings and a covered sit-out that looks straight onto the hills. The caretaker lives on site and can arrange home-cooked Maharashtrian meals.',
  },
  {
    slug: 'dev-alibaug-coconut-grove-villa',
    host: 'meera',
    title: 'Coconut Grove Villa near Kihim Beach',
    type: 'VILLA',
    city: 'Alibaug',
    state: 'Maharashtra',
    location: 'Kihim, Alibaug',
    pincode: '402208',
    lat: 18.7236,
    lng: 72.8686,
    guests: 8,
    bedrooms: 3,
    bathrooms: 3,
    price: 11000,
    weekend: 14000,
    extraGuest: 600,
    couple: true,
    tone: 'beach',
    amenities: [
      'Private pool',
      'Wi-Fi',
      'Parking',
      'Kitchen',
      'Air conditioning',
    ],
    description:
      'A quiet three-bedroom villa in a coconut grove, a five-minute walk from Kihim beach. Plunge pool, open kitchen and a hammock deck made for slow weekends.',
  },
  {
    slug: 'dev-pune-sunset-party-house',
    host: 'arjun',
    title: 'Sunset Party House with DJ Deck',
    type: 'PARTY_HOUSE',
    city: 'Pune',
    state: 'Maharashtra',
    location: 'Pirangut, Pune',
    pincode: '412115',
    lat: 18.5093,
    lng: 73.6817,
    guests: 25,
    bedrooms: 3,
    bathrooms: 3,
    price: 18000,
    weekend: 24000,
    extraGuest: 500,
    party: true,
    tone: 'night',
    amenities: [
      'Private pool',
      'Lawn',
      'Music system',
      'Projector',
      'Parking',
      'Barbecue',
    ],
    description:
      'Built for birthdays and reunions: a lit pool deck, a covered DJ area with a sound system, and a lawn that seats forty for dinner. Three bedrooms for those who stay the night.',
  },
  {
    slug: 'dev-goa-assagao-pool-villa',
    host: 'arjun',
    title: 'Assagao Pool Villa',
    type: 'POOL_PROPERTY',
    city: 'Goa',
    state: 'Goa',
    location: 'Assagao, North Goa',
    pincode: '403507',
    lat: 15.5937,
    lng: 73.7695,
    guests: 10,
    bedrooms: 4,
    bathrooms: 4,
    price: 16500,
    weekend: 21000,
    extraGuest: 900,
    trusted: true,
    tone: 'pool',
    amenities: [
      'Private pool',
      'Wi-Fi',
      'Air conditioning',
      'Kitchen',
      'Caretaker',
      'Parking',
    ],
    description:
      'A Portuguese-style villa with a 12-metre pool among the Assagao cafés. Four air-conditioned bedrooms, a courtyard for long breakfasts, and Anjuna beach twenty minutes away.',
  },
  {
    slug: 'dev-udaipur-haveli-courtyard',
    host: 'meera',
    title: 'Haveli Courtyard Stay by Lake Pichola',
    type: 'WEEKEND_STAY',
    city: 'Udaipur',
    state: 'Rajasthan',
    location: 'Hanuman Ghat, Udaipur',
    pincode: '313001',
    lat: 24.5796,
    lng: 73.6813,
    guests: 6,
    bedrooms: 3,
    bathrooms: 2,
    price: 9500,
    weekend: 11500,
    couple: true,
    tone: 'desert',
    amenities: ['Wi-Fi', 'Air conditioning', 'Kitchen', 'Caretaker'],
    description:
      'A restored haveli with a painted courtyard and a rooftop that looks across Lake Pichola to the City Palace. Walkable to the ghats and the old city.',
  },
  {
    slug: 'dev-jaipur-desert-farm-venue',
    host: 'arjun',
    title: 'Desert Farm Event Venue',
    type: 'EVENT_VENUE',
    city: 'Jaipur',
    state: 'Rajasthan',
    location: 'Ajmer Road, Jaipur',
    pincode: '302026',
    lat: 26.8467,
    lng: 75.6829,
    guests: 60,
    bedrooms: 4,
    bathrooms: 5,
    price: 35000,
    weekend: 45000,
    extraGuest: 400,
    party: true,
    tone: 'desert',
    amenities: [
      'Lawn',
      'Music system',
      'Parking',
      'Bonfire',
      'Caretaker',
      'Barbecue',
    ],
    description:
      'Two acres of lawn with a stage, bonfire pit and parking for forty cars, twenty minutes from the city. Four rooms for the family on the night of the event.',
  },
  {
    slug: 'dev-gurugram-garden-jacuzzi-retreat',
    host: 'meera',
    title: 'Romantic Garden Retreat | Jacuzzi + Cinema',
    type: 'WEEKEND_STAY',
    city: 'Gurugram',
    state: 'Haryana',
    location: 'Sector 57, Gurugram',
    pincode: '122011',
    lat: 28.4231,
    lng: 77.0839,
    guests: 3,
    bedrooms: 1,
    bathrooms: 1,
    price: 5950,
    weekend: 7500,
    couple: true,
    adultOnly: true,
    tone: 'night',
    amenities: [
      'Jacuzzi',
      'Projector',
      'Wi-Fi',
      'Air conditioning',
      'Music system',
    ],
    description:
      'A private garden room with an outdoor jacuzzi under fairy lights and a projector screen for movie nights. Made for anniversaries and proposals.',
  },
  {
    slug: 'dev-karjat-riverside-farm',
    host: 'arjun',
    title: 'Riverside Farm Cottages',
    type: 'FARMHOUSE',
    city: 'Karjat',
    state: 'Maharashtra',
    location: 'Kondivade, Karjat',
    pincode: '410201',
    lat: 18.9107,
    lng: 73.3235,
    guests: 15,
    bedrooms: 5,
    bathrooms: 4,
    price: 12500,
    weekend: 15500,
    extraGuest: 700,
    party: true,
    tone: 'hills',
    amenities: [
      'Lawn',
      'Bonfire',
      'Barbecue',
      'Parking',
      'Kitchen',
      'Caretaker',
    ],
    description:
      'Five cottages along the river on a working mango farm. Swim in the river in monsoon, bonfire and barbecue on the lawn in winter.',
  },
];

// --- Placeholder photos -----------------------------------------------------------

const PALETTES: Record<Tone, [string, string, string]> = {
  pool: ['#0e3a5c', '#1d7fa6', '#8fe3f0'],
  lawn: ['#16351f', '#2f6b3a', '#b5e08c'],
  night: ['#120d24', '#3b1f5c', '#ff9aa0'],
  desert: ['#5a2d12', '#c46a2b', '#ffd7a0'],
  beach: ['#0b3d4f', '#2a9d8f', '#f4e3b2'],
  hills: ['#1f2a36', '#4a6d52', '#d9e7b8'],
};

const SCENES = ['Outside', 'Pool and lawn', 'Inside'] as const;

/*
  The API serves uploads as JPEG, PNG or WebP only (SVG is refused, since it
  can carry script), so the placeholders are PNGs, drawn here pixel by pixel
  and encoded with zlib: no image library needed. No text is drawn; the
  listing title is on the page anyway.
*/
const WIDTH = 960;
const HEIGHT = 640;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: number[], b: number[], t: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as [
    number,
    number,
    number,
  ];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A simple landscape so every sample listing has a distinct cover. */
function placeholderPng(tone: Tone, scene: number, seed: number): Buffer {
  const [dark, mid, light] = PALETTES[tone].map(rgb);
  const rows: Buffer[] = [];
  const sunX = WIDTH * (0.62 + 0.2 * ((seed % 5) / 5));
  const sunY = HEIGHT * 0.24;
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = Buffer.alloc(1 + WIDTH * 3); // filter byte 0 = none
    for (let x = 0; x < WIDTH; x += 1) {
      let color = mix(dark, mid, y / HEIGHT);
      if ((x - sunX) ** 2 + (y - sunY) ** 2 < 60 ** 2)
        color = mix(color, light, 0.85);
      const far = HEIGHT * 0.66 + Math.sin(x / 140 + seed) * 40;
      const near = HEIGHT * 0.8 + Math.sin(x / 90 + seed * 2) * 22;
      if (y > far) color = mix(mid, dark, 0.25);
      if (y > near) color = mix(dark, [0, 0, 0], 0.2);
      if (scene === 0 && x > 380 && x < 600 && y > 330 && y < 470)
        color = mix(light, mid, 0.15);
      if (
        scene === 0 &&
        y <= 330 &&
        y > 250 &&
        Math.abs(x - 490) < (y - 250) * 1.5
      )
        color = light;
      if (scene === 1 && y > 470 && y < 590 && x > 120 && x < 840) {
        const ripple = Math.sin(x / 18 + y / 7) > 0.85 ? 0.35 : 0;
        color = mix(mix(light, mid, 0.35), [255, 255, 255], ripple);
      }
      if (scene === 2 && y > 200 && y < 560 && x > 140 && x < 820) {
        color = mix(dark, [0, 0, 0], 0.35);
        const pane = (x > 200 && x < 450) || (x > 510 && x < 760);
        if (pane && y > 250 && y < 430) color = mix(light, mid, 0.4);
      }
      row.set(color, 1 + x * 3);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Seeding ----------------------------------------------------------------------

function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertUser(
  prisma: PrismaClient,
  passwordHash: string,
  input: {
    email: string;
    name: string;
    phone: string;
    role: 'OWNER' | 'CUSTOMER';
  },
) {
  const now = new Date();
  return prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: input.role,
      passwordHash,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
    update: {
      name: input.name,
      role: input.role,
      passwordHash,
      isActive: true,
    },
  });
}

async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const hosts: Record<keyof typeof HOSTS, string> = { meera: '', arjun: '' };
  for (const [key, host] of Object.entries(HOSTS) as Array<
    [keyof typeof HOSTS, (typeof HOSTS)[keyof typeof HOSTS]]
  >) {
    const user = await upsertUser(prisma, passwordHash, {
      email: `${key}.host@${EMAIL_DOMAIN}`,
      name: host.name,
      phone: host.phone,
      role: 'OWNER',
    });
    await prisma.ownerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        businessName: host.business,
        kycVerified: true,
        kycStatus: 'VERIFIED',
        kycSubmittedAt: new Date(),
        kycReviewedAt: new Date(),
      },
      update: {
        businessName: host.business,
        kycVerified: true,
        kycStatus: 'VERIFIED',
      },
    });
    hosts[key] = user.id;
  }
  await upsertUser(prisma, passwordHash, {
    email: `guest@${EMAIL_DOMAIN}`,
    name: GUEST.name,
    phone: GUEST.phone,
    role: 'CUSTOMER',
  });

  const amenityIds = new Map<string, string>();
  for (const name of AMENITIES) {
    const slug = slugOf(name);
    const amenity =
      (await prisma.amenity.findFirst({
        where: { OR: [{ slug }, { name }] },
      })) ?? (await prisma.amenity.create({ data: { name, slug } }));
    amenityIds.set(name, amenity.id);
  }

  rmSync(UPLOAD_DIR, { recursive: true, force: true });
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const [index, listing] of LISTINGS.entries()) {
    const data = {
      ownerId: hosts[listing.host],
      title: listing.title,
      description: listing.description,
      propertyType: listing.type,
      location: listing.location,
      city: listing.city,
      state: listing.state,
      pincode: listing.pincode,
      address: `Sample address, ${listing.location}`,
      latitude: listing.lat,
      longitude: listing.lng,
      guestCapacity: listing.guests,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      basePrice: listing.price,
      weekendPrice: listing.weekend ?? null,
      extraGuestCharge: listing.extraGuest ?? null,
      propertyRules: HOUSE_RULES,
      partyRules: listing.party ? PARTY_RULES : null,
      cancellationPolicy: CANCELLATION,
      isPartyFriendly: Boolean(listing.party),
      isCoupleFriendly: Boolean(listing.couple),
      isAdultOnly: Boolean(listing.adultOnly),
      isTrusted: Boolean(listing.trusted),
      trustedAt: listing.trusted ? new Date() : null,
      status: 'APPROVED' as const,
      deletedAt: null,
    };
    const property = await prisma.property.upsert({
      where: { slug: listing.slug },
      create: { slug: listing.slug, ...data },
      update: data,
    });

    // Children are rebuilt on every run so the sample stays exactly as defined.
    await prisma.propertyImage.deleteMany({
      where: { propertyId: property.id },
    });
    await prisma.propertyAmenity.deleteMany({
      where: { propertyId: property.id },
    });

    for (let scene = 0; scene < SCENES.length; scene += 1) {
      const file = `${listing.slug}-${scene + 1}.png`;
      writeFileSync(
        join(UPLOAD_DIR, file),
        placeholderPng(listing.tone, scene, index + scene),
      );
      await prisma.propertyImage.create({
        data: {
          propertyId: property.id,
          url: `/uploads/dev-seed/${file}`,
          publicId: `dev-seed/${file}`,
          altText: `${listing.title} — ${SCENES[scene].toLowerCase()}`,
          sortOrder: scene,
          isCover: scene === 0,
        },
      });
    }

    await prisma.propertyAmenity.createMany({
      data: listing.amenities.map((name) => ({
        propertyId: property.id,
        amenityId: amenityIds.get(name)!,
      })),
      skipDuplicates: true,
    });

    // A couple of host-blocked nights, so the calendar has something to show.
    // Booked nights are left to real test bookings.
    const blocked = [3 + index, 10 + ((index * 3) % 7)];
    for (const offset of blocked) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + offset);
      await prisma.availability.upsert({
        where: { propertyId_date: { propertyId: property.id, date } },
        create: {
          propertyId: property.id,
          date,
          status: 'BLOCKED',
          notes: 'dev-seed',
        },
        update: {},
      });
    }
  }

  console.log(
    `\n[dev-seed] Ready: ${LISTINGS.length} approved sample listings.\n`,
  );
  console.log('  Sign in with (password for all three):', PASSWORD);
  console.log(`    host   meera.host@${EMAIL_DOMAIN}`);
  console.log(`    host   arjun.host@${EMAIL_DOMAIN}`);
  console.log(`    guest  guest@${EMAIL_DOMAIN}\n`);
}

/** Removes only what this script creates, including test bookings made on it. */
async function reset(prisma: PrismaClient): Promise<void> {
  const properties = await prisma.property.findMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
    select: { id: true },
  });
  const propertyIds = properties.map((p) => p.id);
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { propertyId: { in: propertyIds } },
        { customerId: { in: userIds } },
      ],
    },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  await prisma.$transaction([
    prisma.refund.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    prisma.commission.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    prisma.bookingNight.deleteMany({
      where: { bookingId: { in: bookingIds } },
    }),
    prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
    prisma.property.deleteMany({ where: { id: { in: propertyIds } } }),
    prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
  rmSync(UPLOAD_DIR, { recursive: true, force: true });

  console.log(
    `\n[dev-seed] Removed ${propertyIds.length} sample listings, ${userIds.length} sample users and ${bookingIds.length} bookings made on them.\n`,
  );
}

async function main(): Promise<void> {
  assertDevelopmentDatabase();
  const prisma = new PrismaClient();
  try {
    if (process.argv.includes('--reset')) {
      await reset(prisma);
    } else {
      await seed(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[dev-seed] Failed:', error);
  process.exit(1);
});
