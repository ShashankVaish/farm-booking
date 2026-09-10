import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserRoles } from '../../common/constants/roles';
import { normalizePagination } from '../../common/pagination';
import type { RequestUser } from '../auth/auth.types';
import { UpdateOwnerProfileDto } from './dto/owner.dto';
import {
  RequestHostPhoneOtpDto,
  SaveBankAccountDto,
  SubmitHostKycDto,
  VerifyHostPhoneOtpDto,
} from './dto/kyc.dto';
import { HostKycService } from './host-kyc.service';
import { OwnerService } from './owner.service';

@Controller('owner')
@Roles(UserRoles.OWNER)
export class OwnerController {
  constructor(
    private readonly owner: OwnerService,
    private readonly kyc: HostKycService,
  ) {}

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

  @Get('kyc')
  kycStatus(@CurrentUser() user: RequestUser) {
    return this.kyc.status(user.id);
  }

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('kyc/phone/request')
  requestPhoneOtp(
    @CurrentUser() user: RequestUser,
    @Body() dto: RequestHostPhoneOtpDto,
    @Req() request: Request,
  ) {
    return this.kyc.requestPhoneOtp(user.id, dto, { ipAddress: request.ip });
  }

  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @Post('kyc/phone/verify')
  verifyPhoneOtp(
    @CurrentUser() user: RequestUser,
    @Body() dto: VerifyHostPhoneOtpDto,
  ) {
    return this.kyc.verifyPhoneOtp(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('kyc')
  submitKyc(@CurrentUser() user: RequestUser, @Body() dto: SubmitHostKycDto) {
    return this.kyc.submit(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('bank-account')
  saveBankAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveBankAccountDto,
  ) {
    return this.kyc.saveBankAccount(user.id, dto);
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
