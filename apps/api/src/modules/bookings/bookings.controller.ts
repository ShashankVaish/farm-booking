import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserOptional,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { normalizePagination } from '../../common/pagination';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { PaymentsService } from '../payments/payments.service';
import {
  CancelBookingDto,
  CreateBookingDto,
  QuoteBookingDto,
} from './dto/booking.dto';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @Post('quote')
  quote(
    @Body() dto: QuoteBookingDto,
    @CurrentUserOptional() user?: RequestUser,
  ) {
    return this.bookings.quote(dto, user?.id);
  }

  @Roles(UserRoles.CUSTOMER)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Get('my')
  my(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    return this.bookings.listMine(user, page, limit);
  }

  @Get(':id')
  getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.bookings.getById(id, user);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookings.cancel(id, user, dto, (bookingId, reason) =>
      this.payments.requestRefundForBooking(bookingId, reason),
    );
  }

  @Roles(UserRoles.OWNER)
  @Post(':id/complete')
  complete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.bookings.complete(id, user);
  }
}
