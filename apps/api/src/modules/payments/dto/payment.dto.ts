import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsUUID()
  bookingId!: string;
}

export class VerifyPaymentDto {
  @IsString()
  providerOrderId!: string;

  @IsString()
  providerPaymentId!: string;

  @IsString()
  signature!: string;
}

export class RequestRefundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @Type(() => Number)
  amount?: number;
}
