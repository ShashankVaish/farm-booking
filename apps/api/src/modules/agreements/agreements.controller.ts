import { Body, Controller, Get, Post, Put, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { AgreementsService } from './agreements.service';
import { PublishAgreementDto, SignAgreementDto } from './dto/agreement.dto';

/*
  Host side lives under /api/owner/agreement, admin side under
  /api/admin/agreement, matching where the rest of each role's routes are.
*/

@Controller('owner/agreement')
@Roles(UserRoles.OWNER)
export class HostAgreementController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get()
  current(
    @CurrentUser() user: RequestUser,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.agreements.forHost(user, propertyId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('sign')
  sign(
    @CurrentUser() user: RequestUser,
    @Body() dto: SignAgreementDto,
    @Req() request: Request,
  ) {
    return this.agreements.sign(user, dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}

@Controller('admin/agreement')
@Roles(UserRoles.ADMIN)
export class AdminAgreementController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get()
  view() {
    return this.agreements.adminView();
  }

  /*
    The only way the agreement's text can change. Every call is a new version;
    there is no edit-in-place, by design.
  */
  @Put()
  publish(@CurrentUser() user: RequestUser, @Body() dto: PublishAgreementDto) {
    return this.agreements.publish(user.id, dto);
  }
}
