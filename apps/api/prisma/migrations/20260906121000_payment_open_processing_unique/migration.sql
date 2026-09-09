DROP INDEX IF EXISTS "Payment_one_open_per_booking_key";

CREATE UNIQUE INDEX "Payment_one_open_per_booking_key"
ON "Payment" ("bookingId")
WHERE "status" IN ('CREATED', 'PENDING', 'PROCESSING');
