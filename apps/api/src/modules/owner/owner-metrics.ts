import { BookingStatus } from '@prisma/client';

export function occupancyRate(
  bookedNights: number,
  propertyCount: number,
  days: number,
): number {
  const possible = propertyCount * days;
  if (possible <= 0) {
    return 0;
  }
  return Math.min(1, bookedNights / possible);
}

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];
