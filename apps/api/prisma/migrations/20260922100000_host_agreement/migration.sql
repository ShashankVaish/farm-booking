-- Host agreement: admin-authored, versioned; hosts sign per listing before
-- submitting for approval.

CREATE TABLE "HostAgreement" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "HostAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HostAgreement_version_key" ON "HostAgreement"("version");
CREATE INDEX "HostAgreement_isActive_idx" ON "HostAgreement"("isActive");

ALTER TABLE "HostAgreement" ADD CONSTRAINT "HostAgreement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HostAgreementAcceptance" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "signatureName" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostAgreementAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HostAgreementAcceptance_agreementId_propertyId_key" ON "HostAgreementAcceptance"("agreementId", "propertyId");
CREATE INDEX "HostAgreementAcceptance_propertyId_idx" ON "HostAgreementAcceptance"("propertyId");
CREATE INDEX "HostAgreementAcceptance_userId_idx" ON "HostAgreementAcceptance"("userId");

ALTER TABLE "HostAgreementAcceptance" ADD CONSTRAINT "HostAgreementAcceptance_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "HostAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HostAgreementAcceptance" ADD CONSTRAINT "HostAgreementAcceptance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostAgreementAcceptance" ADD CONSTRAINT "HostAgreementAcceptance_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Version 1, so hosts are never blocked by an empty agreement before an admin
-- has written one. The admin panel replaces it with version 2 on first save.
INSERT INTO "HostAgreement" ("id", "version", "title", "body", "isActive")
VALUES (
    gen_random_uuid()::text,
    1,
    'Host Agreement',
    E'## 1. Listing and approval\n' ||
    E'- You confirm that you own the property or are authorised by the owner to list it, and that every detail in the listing — photographs, capacity, amenities, pricing and house rules — is accurate and current.\n' ||
    E'- A listing goes live only after the Platform approves it. The Platform may request changes, decline, or later suspend a listing that no longer meets its standards.\n' ||
    E'\n## 2. Bookings\n' ||
    E'- A booking confirmed and paid through the Platform is a binding reservation. You will honour every confirmed booking at the price and on the dates shown at the time of booking.\n' ||
    E'- You will keep your calendar accurate. Dates that are not available must be blocked; a confirmed booking that cannot be honoured because of a calendar error is treated as a host cancellation.\n' ||
    E'- Guests pay the Platform, never you directly. You will not ask a guest to pay outside the Platform, in whole or in part.\n' ||
    E'\n## 3. Money transfer and payouts\n' ||
    E'- The guest''s payment is collected by the Platform through its payment gateway and held until the stay begins.\n' ||
    E'- Your payout is the booking amount less the Platform service fee shown in your earnings breakdown, and less any refund, penalty or approved damage amount that applies to that booking.\n' ||
    E'- Payouts are transferred to the bank account on your host profile after check-in, in the payout cycle shown in your Earnings page. You are responsible for keeping those bank details correct; a transfer to details you supplied is a completed payout.\n' ||
    E'- The Platform may withhold a payout while a dispute, refund request or verification concern about the booking is open.\n' ||
    E'\n## 4. Cancellations and refunds\n' ||
    E'- Guest cancellations and refunds follow the cancellation policy on your listing and the Platform''s Cancellation & Refund Policy.\n' ||
    E'- If you cancel a confirmed booking, the guest receives a full refund from the Platform. The Platform may recover a cancellation charge from your future payouts and may restrict or remove a listing after repeated cancellations.\n' ||
    E'\n## 5. Taxes and compliance\n' ||
    E'- You are responsible for any tax due on your income from bookings, and for any licence, permission or registration the property needs to be let.\n' ||
    E'- You have completed the Platform''s host verification and will keep the identity, PAN and bank details on your profile accurate.\n' ||
    E'\n## 6. Changes to this agreement\n' ||
    E'- The Platform may update this agreement. When it does, you will be asked to sign the new version before your next listing is submitted, and it applies to bookings made after you sign.\n' ||
    E'\n## 7. Signature\n' ||
    E'- By typing your full name below and submitting, you sign this agreement electronically. It has the same effect as a handwritten signature.',
    true
);
