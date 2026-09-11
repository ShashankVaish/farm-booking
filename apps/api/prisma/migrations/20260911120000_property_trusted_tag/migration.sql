-- Admin-awarded trust badge.
--
-- Defaults to false so every existing listing keeps the status quo: the badge
-- is something an admin grants after a manual check, not something that should
-- appear on old rows by accident.
ALTER TABLE "Property" ADD COLUMN "isTrusted" BOOLEAN NOT NULL DEFAULT false;

-- When it was granted. Nullable because "never trusted" and "trusted at an
-- unknown time" are different states, and a NOT NULL default would erase the
-- difference on every existing row.
ALTER TABLE "Property" ADD COLUMN "trustedAt" TIMESTAMP(3);

-- The public site queries trusted listings among approved ones, so the index
-- matches that pair rather than the flag alone.
CREATE INDEX "Property_status_isTrusted_idx" ON "Property"("status", "isTrusted");
