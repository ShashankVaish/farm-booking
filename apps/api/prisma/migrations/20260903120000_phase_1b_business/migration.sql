-- Property discovery fields (party-friendly filter + denormalized rating for search sort)
ALTER TABLE "Property" ADD COLUMN "isPartyFriendly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0;
ALTER TABLE "Property" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Property_status_isPartyFriendly_idx" ON "Property"("status", "isPartyFriendly");
CREATE INDEX "Property_status_basePrice_idx" ON "Property"("status", "basePrice");
CREATE INDEX "Property_status_averageRating_idx" ON "Property"("status", "averageRating");
CREATE INDEX "Property_status_createdAt_idx" ON "Property"("status", "createdAt");

-- Payment order uniqueness (idempotent order creation / webhook matching)
DROP INDEX "Payment_providerOrderId_idx";
CREATE UNIQUE INDEX "Payment_provider_providerOrderId_key" ON "Payment"("provider", "providerOrderId");

-- Refresh-token rotation + reuse detection
ALTER TABLE "RefreshToken" ADD COLUMN "familyId" TEXT;
UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "RefreshToken" ADD COLUMN "replacedById" TEXT;
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- Provider-backed refund tracking (never fake COMPLETED)
ALTER TABLE "Refund" ADD COLUMN "providerRefundId" TEXT;
ALTER TABLE "Refund" ADD COLUMN "providerStatus" TEXT;
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");
