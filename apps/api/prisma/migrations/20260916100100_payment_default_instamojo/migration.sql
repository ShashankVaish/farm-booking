-- Separate from the ADD VALUE above: Postgres refuses to use a new enum value
-- in the same transaction that created it.
ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'INSTAMOJO';
