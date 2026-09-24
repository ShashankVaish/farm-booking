-- WhatsApp booking updates: opt-in per user, off by default.
ALTER TABLE "NotificationPreference" ADD COLUMN "whatsapp" BOOLEAN NOT NULL DEFAULT false;
