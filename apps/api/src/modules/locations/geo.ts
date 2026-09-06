import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../../common/constants/error-codes';

export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

export function isValidLatitude(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MIN_LATITUDE && value <= MAX_LATITUDE
  );
}

export function isValidLongitude(value: number): boolean {
  return (
    Number.isFinite(value) && value >= MIN_LONGITUDE && value <= MAX_LONGITUDE
  );
}

export function isNullIsland(latitude: number, longitude: number): boolean {
  return latitude === 0 && longitude === 0;
}

export function assertValidCoordinates(
  latitude: number,
  longitude: number,
): void {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    throw new BadRequestException({
      errorCode: ErrorCodes.INVALID_COORDINATES,
      message:
        'Latitude must be between -90 and 90 and longitude between -180 and 180.',
    });
  }

  if (isNullIsland(latitude, longitude)) {
    throw new BadRequestException({
      errorCode: ErrorCodes.INVALID_COORDINATES,
      message: 'Map pin is not set. Confirm a location on the map.',
    });
  }
}
