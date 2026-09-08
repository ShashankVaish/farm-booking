import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ErrorCodes } from '../../common/constants/error-codes';

const MAGIC: Array<{ type: 'jpeg' | 'png' | 'webp'; ext: string; test: (buf: Buffer) => boolean }> =
  [
    {
      type: 'jpeg',
      ext: '.jpg',
      test: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
    },
    {
      type: 'png',
      ext: '.png',
      test: (buf) =>
        buf.length > 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47,
    },
    {
      type: 'webp',
      ext: '.webp',
      test: (buf) =>
        buf.length > 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP',
    },
  ];

@Injectable()
export class MediaService {
  private readonly directory = join(process.cwd(), 'uploads');

  async saveListingImage(file: Express.Multer.File) {
    const detected = MAGIC.find((entry) => entry.test(file.buffer));
    if (!detected) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Upload a JPEG, PNG, or WebP image.',
      });
    }

    const publicId = `${randomUUID()}${detected.ext}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, publicId), file.buffer);

    const alt = file.originalname
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '')
      .replace(/[<>]/g, '')
      .slice(0, 120);

    return {
      publicId,
      url: `/uploads/${publicId}`,
      alt: alt || 'Listing photo',
    };
  }
}
