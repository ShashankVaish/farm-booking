-- Day party / night party bookings.
-- Every existing booking is an overnight stay, which is the column default.
CREATE TYPE "BookingSlot" AS ENUM ('OVERNIGHT', 'DAY', 'NIGHT');

ALTER TABLE "Booking" ADD COLUMN "slot" "BookingSlot" NOT NULL DEFAULT 'OVERNIGHT';
ALTER TABLE "Booking" ADD COLUMN "slotStartTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN "slotEndTime" TEXT;

-- Optional flat prices per sitting; null falls back to the nightly rate.
ALTER TABLE "Property" ADD COLUMN "dayPartyPrice" DECIMAL(12,2);
ALTER TABLE "Property" ADD COLUMN "nightPartyPrice" DECIMAL(12,2);
