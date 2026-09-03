import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CreatePaymentOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('orders')
  createOrder(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    return this.payments.createOrder(user, dto);
  }

  @Post('verify')
  verify(@Body() dto: VerifyPaymentDto) {
    return this.payments.verifyCheckout(dto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw =
      request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});
    return this.payments.handleWebhook(raw, signature);
  }
}
