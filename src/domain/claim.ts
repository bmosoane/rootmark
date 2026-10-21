import type { StoredCheckResult } from "@/domain/claim-schema";

export type {
  DnsCheckResult,
  StoredCheckResult,
} from "@/domain/claim-schema";

export const CLAIM_STATUSES = ["pending", "verified"] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type CheckResult =
  | StoredCheckResult
  | { kind: "rate_limited"; retryAfterSeconds: number };

export type Claim = {
  id: string;
  domain: string;
  token: string;
  status: ClaimStatus;
  createdAt: string;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  latestResult: StoredCheckResult | null;
};

export function challengeFor(claim: Pick<Claim, "domain" | "token">) {
  return {
    type: "TXT" as const,
    host: "_rootmark",
    fqdn: `_rootmark.${claim.domain}`,
    value: `rootmark=${claim.token}`,
  };
}
