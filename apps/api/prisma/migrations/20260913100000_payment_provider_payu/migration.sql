-- The platform moved from Razorpay to PayU. The old enum value is kept so
-- every payment already recorded stays readable; only the default changes.
ALTER TYPE "PaymentProviderType" ADD VALUE IF NOT EXISTS 'PAYU';
