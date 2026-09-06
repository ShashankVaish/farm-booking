import { publicEnv } from '@/lib/config/env';

export const brand = {
  name: publicEnv.brandName,
  tagline: 'Find the perfect private place for your next celebration.',
  shortDescription:
    'Private farmhouses, villas, and party venues for gatherings that deserve more than a hotel room.',
} as const;
