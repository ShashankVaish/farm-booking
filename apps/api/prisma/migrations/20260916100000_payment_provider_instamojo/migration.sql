-- The platform moved to Instamojo. Earlier enum values are kept so every
-- payment already recorded stays readable.
ALTER TYPE "PaymentProviderType" ADD VALUE IF NOT EXISTS 'INSTAMOJO';
