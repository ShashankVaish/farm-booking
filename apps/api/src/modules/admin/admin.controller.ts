import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { CreateCouponDto } from '../coupons/dto/create-coupon.dto';
import { UpdateCouponDto } from '../coupons/dto/update-coupon.dto';
import { AdminService } from './admin.service';
import {
  AdminBookingsQueryDto,
  AdminListQueryDto,
  AdminPropertiesQueryDto,
  AdminRefundDto,
  AdminUsersQueryDto,
  ModerateReviewDto,
  RejectPropertyDto,
  SetUserActiveDto,
  UpdateSupportTicketDto,
} from './dto/admin.dto';

@Controller('admin')
@Roles(UserRoles.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.users(query);
  }

  @Patch('users/:id')
  setUserActive(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
  ) {
    return this.admin.setUserActive(id, dto.isActive, user.id);
  }

  @Get('owners')
  owners(@Query() query: AdminListQueryDto) {
    return this.admin.owners(query);
  }

  @Get('properties')
  properties(@Query() query: AdminPropertiesQueryDto) {
    return this.admin.properties(query);
  }

  @Post('properties/:id/approve')
  approve(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.setPropertyStatus(id, PropertyStatus.APPROVED, user.id);
  }

  @Post('properties/:id/reject')
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectPropertyDto,
  ) {
    return this.admin.setPropertyStatus(
      id,
      PropertyStatus.REJECTED,
      user.id,
      dto.reason,
    );
  }

  @Post('properties/:id/suspend')
  suspend(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.setPropertyStatus(id, PropertyStatus.SUSPENDED, user.id);
  }

  @Get('bookings')
  bookings(@Query() query: AdminBookingsQueryDto) {
    return this.admin.bookings(query);
  }

  @Get('payments')
  payments(@Query() query: AdminListQueryDto) {
    return this.admin.payments(query);
  }

  @Post('payments/:id/reconcile')
  reconcile(@Param('id') id: string) {
    return this.admin.reconcilePayment(id);
  }

  @Post('payments/expire-abandoned')
  expireAbandoned() {
    return this.admin.expireAbandonedPayments();
  }

  @Get('refunds')
  refunds(@Query() query: AdminListQueryDto) {
    return this.admin.refunds(query);
  }

  @Post('bookings/:id/refund')
  refund(@Param('id') id: string, @Body() dto: AdminRefundDto) {
    return this.admin.requestRefund(id, dto.reason);
  }

  @Get('reviews')
  reviews(@Query() query: AdminListQueryDto) {
    return this.admin.reviews(query);
  }

  @Patch('reviews/:id')
  moderateReview(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.admin.moderateReview(id, dto.isPublished);
  }

  @Get('support-tickets')
  tickets(@Query() query: AdminListQueryDto) {
    return this.admin.tickets(query);
  }

  @Patch('support-tickets/:id')
  updateTicket(@Param('id') id: string, @Body() dto: UpdateSupportTicketDto) {
    return this.admin.updateTicket(id, dto.status);
  }

  @Get('coupons')
  coupons(@Query() query: AdminListQueryDto) {
    return this.admin.listCoupons(query);
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.admin.createCoupon(dto);
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.admin.updateCoupon(id, dto);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) {
    return this.admin.deleteCoupon(id);
  }
}
