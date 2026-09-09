import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  bookingConfirmation?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentSuccess?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentFailure?: boolean;

  @IsOptional()
  @IsBoolean()
  cancellation?: boolean;

  @IsOptional()
  @IsBoolean()
  refund?: boolean;

  @IsOptional()
  @IsBoolean()
  propertyApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  propertyRejection?: boolean;

  @IsOptional()
  @IsBoolean()
  newReview?: boolean;

  @IsOptional()
  @IsBoolean()
  coupon?: boolean;
}
