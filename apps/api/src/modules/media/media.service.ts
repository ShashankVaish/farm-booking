import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { ErrorCodes } from '../../common/constants/error-codes';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class MediaService {
  private readonly directory = join(process.cwd(), 'uploads');

  async saveListingImage(file: Express.Multer.File) {
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Upload a JPEG, PNG, or WebP image.',
      });
    }

    const extension = extname(file.originalname).toLowerCase() || '.jpg';
    const publicId = `${randomUUID()}${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, publicId), file.buffer);

    return {
      publicId,
      url: `/uploads/${publicId}`,
      alt: file.originalname.replace(/\.[^.]+$/, ''),
    };
  }
}
