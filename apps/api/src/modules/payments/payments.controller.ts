import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
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

  @Post('bookings/:bookingId/reconcile')
  reconcileBooking(
    @CurrentUser() user: RequestUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.payments.reconcileForUser(user, bookingId);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    if (!request.rawBody?.length) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Webhook body is missing.',
      });
    }
    const raw = request.rawBody.toString('utf8');
    return this.payments.handleWebhook(raw, signature, eventId);
  }
}
