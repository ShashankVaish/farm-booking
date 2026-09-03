import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserRoles } from '../../common/constants/roles';
import { normalizePagination } from '../../common/pagination';
import type { RequestUser } from '../auth/auth.types';
import { OwnerService } from './owner.service';

@Controller('owner')
@Roles(UserRoles.OWNER)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

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
}
