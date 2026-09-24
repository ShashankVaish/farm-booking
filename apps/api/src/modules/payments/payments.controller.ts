import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCodes } from '../../common/constants/error-codes';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CreatePaymentOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('orders')
  createOrder(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return this.payments.createOrder(user, dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('verify')
  verify(@CurrentUser() user: RequestUser, @Body() dto: VerifyPaymentDto) {
    return this.payments.verifyCheckout(user, dto);
  }

  /*
    Polled by the checkout page while a payment is open. The limit is sized
    for a page that asks every few seconds, not one that asks in a loop: the
    page once did the latter, hit this, and rendered the 429 as a spinner.
  */
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Post('bookings/:bookingId/reconcile')
  reconcileBooking(
    @CurrentUser() user: RequestUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.payments.reconcileForUser(user, bookingId);
  }

  /*
    The gateway sends the guest's browser back here after the hosted checkout
    page, whatever the outcome. We answer with a redirect to the booking page —
    a person should never be looking at an API response.

    Public and unthrottled by design: it is reached from the gateway's domain
    with no session, and a legitimate guest arriving here after paying must
    never be turned away. Only the order id is read from the request; the
    outcome is fetched from the gateway, so there is nothing to gain by
    calling it.

    PhonePe comes back with a GET and our order id in the query string. The
    POST form is kept for a gateway that posts the browser back; the order id
    is still read from the URL first, then from the posted body.
  */
  @Public()
  @Post('return')
  async gatewayReturnPost(
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response,
  ) {
    const query = request.url.split('?')[1] ?? '';
    const raw = query || (request.rawBody?.toString('utf8') ?? '');
    const { redirectTo } = await this.payments.handleReturn(raw);
    response.redirect(302, redirectTo);
  }

  @Public()
  @Get('return')
  async gatewayReturnGet(@Req() request: Request, @Res() response: Response) {
    const query = request.url.split('?')[1] ?? '';
    const { redirectTo } = await this.payments.handleReturn(query);
    response.redirect(302, redirectTo);
  }

  /**
   * Server-to-server notification from the gateway. PhonePe authenticates it
   * with a hash of the webhook username and password in `Authorization`.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('authorization') authorization?: string,
    @Headers('x-event-id') eventId?: string,
  ) {
    if (!request.rawBody?.length) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Webhook body is missing.',
      });
    }
    const raw = request.rawBody.toString('utf8');
    return this.payments.handleWebhook(raw, {
      authorization,
      'x-event-id': eventId,
    });
  }
}
