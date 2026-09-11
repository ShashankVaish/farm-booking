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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { CreateCouponDto } from '../coupons/dto/create-coupon.dto';
import { UpdateCouponDto } from '../coupons/dto/update-coupon.dto';
import { AdminService } from './admin.service';
import { PayoutsService } from './payouts.service';
import {
  AdminBookingsQueryDto,
  AdminPayoutsQueryDto,
  AdminCancelBookingDto,
  AdminListQueryDto,
  AdminPaymentsQueryDto,
  AdminPropertiesQueryDto,
  AdminRefundDto,
  AdminReportsQueryDto,
  AdminUsersQueryDto,
  ModerateReviewDto,
  PropertyModerationDto,
  SetUserActiveDto,
  UpdatePlatformSettingsDto,
  UpdateSupportTicketDto,
} from './dto/admin.dto';

@Controller('admin')
@Roles(UserRoles.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('reports')
  reports(@Query() query: AdminReportsQueryDto) {
    return this.admin.reports(query);
  }

  @Get('settings')
  settings() {
    return this.admin.settings();
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    return this.admin.updateSettings(dto, user.id);
  }

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
  owners(@Query() query: AdminUsersQueryDto) {
    return this.admin.owners(query);
  }

  @Get('properties')
  properties(@Query() query: AdminPropertiesQueryDto) {
    return this.admin.properties(query);
  }

  @Get('properties/:id')
  property(@Param('id') id: string) {
    return this.admin.property(id);
  }

  @Post('properties/:id/approve')
  approve(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.approveProperty(id, user.id);
  }

  @Post('properties/:id/reject')
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PropertyModerationDto,
  ) {
    return this.admin.rejectProperty(id, user.id, dto.reason);
  }

  @Post('properties/:id/request-changes')
  requestChanges(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PropertyModerationDto,
  ) {
    return this.admin.requestPropertyChanges(id, user.id, dto.reason);
  }

  @Post('properties/:id/suspend')
  suspend(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PropertyModerationDto,
  ) {
    return this.admin.suspendProperty(id, user.id, dto.reason);
  }

  @Post('properties/:id/restore')
  restore(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.restoreProperty(id, user.id);
  }

  /*
    The only way the Trusted property badge can be set. Deliberately on the
    admin controller, which is guarded as ADMIN for every route — there is no
    equivalent under /api/owner or /api/properties, so a host cannot award it
    to their own listing.
  */
  @Post('properties/:id/trust')
  trust(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.setPropertyTrusted(id, true, user.id);
  }

  @Post('properties/:id/untrust')
  untrust(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.setPropertyTrusted(id, false, user.id);
  }

  @Get('bookings')
  bookings(@Query() query: AdminBookingsQueryDto) {
    return this.admin.bookings(query);
  }

  @Get('bookings/:id')
  booking(@Param('id') id: string) {
    return this.admin.booking(id);
  }

  @Get('payments')
  payments(@Query() query: AdminPaymentsQueryDto) {
    return this.admin.payments(query);
  }

  @Delete('payments/:id')
  deletePayment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.deletePayment(id, user.id);
  }

  @Post('payments/:id/reconcile')
  reconcile(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.reconcilePayment(id, user.id);
  }

  @Post('payments/expire-abandoned')
  expireAbandoned() {
    return this.admin.expireAbandonedPayments();
  }

  @Get('payouts')
  payoutStatement(@Query() query: AdminPayoutsQueryDto) {
    return this.payouts.statement(query);
  }

  @Get('refunds')
  refunds(@Query() query: AdminListQueryDto) {
    return this.admin.refunds(query);
  }

  @Post('bookings/:id/cancel')
  cancelBooking(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AdminCancelBookingDto,
  ) {
    return this.admin.cancelBooking(id, user.id, {
      reason: dto.reason,
      blockDates: dto.blockDates,
    });
  }

  @Post('bookings/:id/refund')
  refund(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AdminRefundDto,
  ) {
    return this.admin.requestRefund(id, user.id, dto.reason, dto.amount);
  }

  @Get('reviews')
  reviews(@Query() query: AdminListQueryDto) {
    return this.admin.reviews(query);
  }

  @Patch('reviews/:id')
  moderateReview(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.admin.moderateReview(id, dto.isPublished, user.id);
  }

  @Get('notifications')
  notifications(@Query() query: AdminListQueryDto) {
    return this.admin.notifications(query);
  }

  @Get('support-tickets')
  tickets(@Query() query: AdminListQueryDto) {
    return this.admin.tickets(query);
  }

  @Patch('support-tickets/:id')
  updateTicket(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.admin.updateTicket(id, dto.status, user.id);
  }

  @Get('coupons')
  coupons(@Query() query: AdminListQueryDto) {
    return this.admin.listCoupons(query);
  }

  @Post('coupons')
  createCoupon(@CurrentUser() user: RequestUser, @Body() dto: CreateCouponDto) {
    return this.admin.createCoupon(dto, user.id);
  }

  @Patch('coupons/:id')
  updateCoupon(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.admin.updateCoupon(id, dto, user.id);
  }

  @Delete('coupons/:id')
  deleteCoupon(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.deleteCoupon(id, user.id);
  }
}
