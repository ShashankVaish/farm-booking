import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserRoles } from '../../common/constants/roles';
import { normalizePagination } from '../../common/pagination';
import type { RequestUser } from '../auth/auth.types';
import { UpdateOwnerProfileDto } from './dto/owner.dto';
import { OwnerService } from './owner.service';

@Controller('owner')
@Roles(UserRoles.OWNER)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Get('overview')
  overview(@CurrentUser() user: RequestUser) {
    return this.owner.overview(user.id);
  }

  @Get('properties')
  properties(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
  ) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    return this.owner.properties(user.id, page, limit);
  }

  @Get('bookings')
  bookings(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
  ) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    return this.owner.bookings(user.id, page, limit);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: RequestUser) {
    return this.owner.earnings(user.id);
  }

  @Get('reviews')
  reviews(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
  ) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    return this.owner.reviews(user.id, page, limit);
  }

  @Get('profile')
  profile(@CurrentUser() user: RequestUser) {
    return this.owner.profile(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOwnerProfileDto,
  ) {
    return this.owner.updateProfile(user.id, dto);
  }
}
