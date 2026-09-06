import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto, BlockDatesDto } from './dto/availability.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Public()
  @Get(':propertyId')
  getCalendar(
    @Param('propertyId') propertyId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availability.getCalendar(propertyId, query.from, query.to);
  }

  @Roles(UserRoles.OWNER)
  @Post(':propertyId/block')
  block(
    @CurrentUser() user: RequestUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: BlockDatesDto,
  ) {
    return this.availability.block(propertyId, user, dto);
  }

  @Roles(UserRoles.OWNER)
  @Post(':propertyId/unblock')
  unblock(
    @CurrentUser() user: RequestUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: BlockDatesDto,
  ) {
    return this.availability.unblock(propertyId, user, dto);
  }
}
