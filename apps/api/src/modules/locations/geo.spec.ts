import { BadRequestException } from '@nestjs/common';
import { assertValidCoordinates } from './geo';

describe('coordinate validation', () => {
  it('accepts a real map pin', () => {
    expect(() => assertValidCoordinates(18.5204, 73.8567)).not.toThrow();
  });

  it('rejects out-of-range and unset pins', () => {
    expect(() => assertValidCoordinates(91, 73)).toThrow(BadRequestException);
    expect(() => assertValidCoordinates(18, 181)).toThrow(BadRequestException);
    expect(() => assertValidCoordinates(0, 0)).toThrow(BadRequestException);
  });
});
