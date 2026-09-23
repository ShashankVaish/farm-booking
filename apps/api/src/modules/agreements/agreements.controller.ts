import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
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

  /*
    The host's own copy of what they signed, as a PDF.

    Sent as an attachment with a no-store header: it carries the signatory's
    name and IP address, and a shared cache holding that would be leaking one
    host's evidence to whoever asked next.
  */
  @Get(':propertyId/pdf')
  async pdf(
    @CurrentUser() user: RequestUser,
    @Param('propertyId') propertyId: string,
    @Res() response: Response,
  ) {
    const { fileName, pdf } = await this.agreements.signedPdf(
      propertyId,
      user.id,
    );
    sendPdf(response, fileName, pdf);
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

  /*
    Any listing's signed agreement. An admin reviewing or defending a booking
    needs the document without asking the host for it; `null` as the requester
    lifts the owner restriction that applies on the host route.
  */
  @Get('property/:propertyId/pdf')
  async pdf(@Param('propertyId') propertyId: string, @Res() response: Response) {
    const { fileName, pdf } = await this.agreements.signedPdf(propertyId, null);
    sendPdf(response, fileName, pdf);
  }
}

/** One place for the headers, so the two routes cannot drift apart. */
function sendPdf(response: Response, fileName: string, pdf: Buffer): void {
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Length', pdf.length);
  response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  // Signed evidence naming a person; never hold it in a shared cache.
  response.setHeader('Cache-Control', 'no-store, private');
  response.end(pdf);
}
