CREATE TABLE domain_claims (
  id uuid PRIMARY KEY,
  session_key text NOT NULL,
  domain text NOT NULL,
  token text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'verified')),
  latest_result jsonb,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_key, domain)
);

CREATE UNIQUE INDEX one_verified_claim_per_domain
ON domain_claims (domain)
WHERE status = 'verified';
