import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorCodes } from '../../common/constants/error-codes';
import { normalizePagination } from '../../common/pagination';
import type { RequestUser } from '../auth/auth.types';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    return this.notifications.list(user.id, page, limit);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: RequestUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.upsertPreferences(user.id, dto);
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const notification = await this.notifications.markRead(user.id, id);
    if (!notification) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Notification not found.',
      });
    }
    return notification;
  }
}
