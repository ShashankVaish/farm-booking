-- Per-listing admin switch for showing reviews to guests; on for every existing listing.
ALTER TABLE "Property" ADD COLUMN "reviewsVisible" BOOLEAN NOT NULL DEFAULT true;
