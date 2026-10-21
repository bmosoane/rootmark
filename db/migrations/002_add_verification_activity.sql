BEGIN;

ALTER TABLE domain_claims
ADD COLUMN verification_activity jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD CONSTRAINT verification_activity_is_array
CHECK (jsonb_typeof(verification_activity) = 'array');

COMMIT;
