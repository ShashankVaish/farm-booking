-- Payment lifecycle states for capture, expiry, and refund tracking.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_FAILED';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Payment_expiresAt_status_idx" ON "Payment"("expiresAt", "status");

DROP INDEX IF EXISTS "Payment_provider_providerPaymentId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- At most one in-flight payment attempt per booking.
-- PROCESSING is added in this migration but cannot be referenced until it is committed.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_one_open_per_booking_key"
ON "Payment" ("bookingId")
WHERE "status" IN ('CREATED', 'PENDING');

DROP INDEX IF EXISTS "Refund_providerRefundId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_createdAt_idx" ON "ProcessedWebhookEvent"("createdAt");
