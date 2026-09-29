-- Day party / night party bookings.
-- Every existing booking was an overnight stay, which is the column default.
CREATE TYPE "BookingSlot" AS ENUM ('OVERNIGHT', 'DAY', 'NIGHT');

ALTER TABLE "Booking" ADD COLUMN "slot" "BookingSlot" NOT NULL DEFAULT 'OVERNIGHT';
ALTER TABLE "Booking" ADD COLUMN "slotStartTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN "slotEndTime" TEXT;

-- Optional flat price for a day party; null charges the night party rate.
ALTER TABLE "Property" ADD COLUMN "dayPartyPrice" DECIMAL(12,2);
