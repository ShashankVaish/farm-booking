import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import { ErrorCodes } from '../../common/constants/error-codes';
import { MediaService } from './media.service';

@Controller('media')
@Roles(UserRoles.OWNER)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Roles(UserRoles.OWNER)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(['', 'upload'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Matches MAX_BYTES in apps/web/src/lib/media/upload.ts.
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, callback) => {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ) {
          callback(
            new BadRequestException({
              errorCode: ErrorCodes.VALIDATION_ERROR,
              message: 'Upload a JPEG, PNG, or WebP image.',
            }),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Choose an image to upload.',
      });
    }
    return this.media.saveListingImage(file);
  }
}
