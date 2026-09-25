-- Removes the word "marketplace" from the host agreement. The payment gateway
-- asked for it: "marketplace" is a separate merchant category for them, and
-- the site describes itself as a booking platform. Meaning is unchanged.
--
-- The new version is the current active text with only these two phrases
-- replaced, so nothing else a host agreed to moves. It runs only while the
-- active version still contains "marketplace": if an admin has already
-- published a revised text from the panel, this does nothing.
--
-- As clause "revisions" of the agreement says, hosts sign the new version the
-- next time they submit a listing; listings already approved are unaffected,
-- and every signed copy keeps the version that was actually signed.

CREATE TEMP TABLE previous_agreement AS
SELECT "title", "body"
FROM "HostAgreement"
WHERE "isActive" = true AND "body" LIKE '%marketplace%'
ORDER BY "version" DESC
LIMIT 1;

INSERT INTO "HostAgreement" ("id", "version", "title", "body", "isActive")
SELECT
    gen_random_uuid()::text,
    (SELECT COALESCE(MAX("version"), 0) + 1 FROM "HostAgreement"),
    "title",
    REPLACE(
        REPLACE(
            "body",
            'The Platform is a technology marketplace that lists accommodation',
            'The Platform is an online booking platform that lists accommodation'
        ),
        'The Platform provides the marketplace and the payment collection service',
        'The Platform provides the booking platform and the payment collection service'
    ),
    false
FROM previous_agreement;

-- Switch the active version only if a new one was inserted above.
UPDATE "HostAgreement"
SET "isActive" = ("version" = (SELECT MAX("version") FROM "HostAgreement"))
WHERE EXISTS (SELECT 1 FROM previous_agreement);

DROP TABLE previous_agreement;
