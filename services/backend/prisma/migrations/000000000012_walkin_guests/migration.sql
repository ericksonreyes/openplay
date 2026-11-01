-- Walk-in (staff-created) guest contacts have no verification credentials;
-- guest self-serve rows still get a token+expiry when the booking flow asks.

ALTER TABLE "guest_contacts" ALTER COLUMN "access_token_hash" DROP NOT NULL;
ALTER TABLE "guest_contacts" ALTER COLUMN "token_expires_at" DROP NOT NULL;
