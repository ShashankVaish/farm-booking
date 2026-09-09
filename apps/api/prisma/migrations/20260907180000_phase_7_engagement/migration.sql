-- AlterTable
ALTER TABLE "Review" ADD COLUMN "ownerResponse" TEXT,
ADD COLUMN "ownerRespondedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "paymentSuccess" BOOLEAN NOT NULL DEFAULT true,
    "paymentFailure" BOOLEAN NOT NULL DEFAULT true,
    "cancellation" BOOLEAN NOT NULL DEFAULT true,
    "refund" BOOLEAN NOT NULL DEFAULT true,
    "propertyApproval" BOOLEAN NOT NULL DEFAULT true,
    "propertyRejection" BOOLEAN NOT NULL DEFAULT true,
    "newReview" BOOLEAN NOT NULL DEFAULT true,
    "coupon" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
