import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import { ErrorCodes } from '../../common/constants/error-codes';
import { MediaService } from './media.service';

@Controller('media')
@Roles(UserRoles.OWNER)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post(['', 'upload'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
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
