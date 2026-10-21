import { randomBytes, randomUUID } from "node:crypto";
import { activityEventFor } from "@/domain/claim";
import type { Claim, StoredCheckResult } from "@/domain/claim";
import type {
  ClaimsRepository,
  CreateClaimResult,
} from "@/server/claims-repository";

type StoredClaim = Claim & { sessionKey: string };
const MAX_ACTIVITY_EVENTS = 20;

function recordActivity(claim: StoredClaim, result: StoredCheckResult) {
  const event = activityEventFor(result);
  const previous = claim.verificationActivity.at(-1);
  if (previous?.kind === event.kind) return;

  claim.verificationActivity = [
    ...claim.verificationActivity,
    event,
  ].slice(-MAX_ACTIVITY_EVENTS);
}

function publicClaim(claim: StoredClaim): Claim {
  return {
    id: claim.id,
    domain: claim.domain,
    token: claim.token,
    status: claim.status,
    createdAt: claim.createdAt,
    lastCheckedAt: claim.lastCheckedAt,
    verifiedAt: claim.verifiedAt,
    latestResult: claim.latestResult,
    verificationActivity: [...claim.verificationActivity],
  };
}

export function createMemoryClaimsRepository(): ClaimsRepository {
  const claims = new Map<string, StoredClaim>();

  return {
    async list(sessionKey) {
      return [...claims.values()]
        .filter((claim) => claim.sessionKey === sessionKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(publicClaim);
    },

    async create(sessionKey, domain): Promise<CreateClaimResult> {
      const existing = [...claims.values()].find(
        (claim) => claim.sessionKey === sessionKey && claim.domain === domain,
      );
      if (existing) return { claim: publicClaim(existing), created: false };

      const claim: StoredClaim = {
        id: randomUUID(),
        sessionKey,
        domain,
        token: randomBytes(24).toString("base64url"),
        status: "pending",
        createdAt: new Date().toISOString(),
        lastCheckedAt: null,
        verifiedAt: null,
        latestResult: null,
        verificationActivity: [],
      };
      claims.set(claim.id, claim);
      return { claim: publicClaim(claim), created: true };
    },

    async remove(id, sessionKey) {
      const claim = claims.get(id);
      if (!claim || claim.sessionKey !== sessionKey) return false;
      return claims.delete(id);
    },

    async startCheck(id, sessionKey, startedAt, cooldownMs) {
      const claim = claims.get(id);
      if (!claim || claim.sessionKey !== sessionKey) return { kind: "not_found" };

      if (claim.lastCheckedAt) {
        const elapsed =
          new Date(startedAt).getTime() - new Date(claim.lastCheckedAt).getTime();
        if (elapsed < cooldownMs) {
          return {
            kind: "rate_limited",
            claim: publicClaim(claim),
            retryAfterSeconds: Math.ceil((cooldownMs - elapsed) / 1000),
          };
        }
      }

      claim.lastCheckedAt = startedAt;
      return { kind: "started", claim: publicClaim(claim) };
    },

    async recordResult(id, sessionKey, result) {
      const claim = claims.get(id);
      if (!claim || claim.sessionKey !== sessionKey) {
        throw new Error("Claim not found");
      }
      claim.latestResult = result;
      claim.lastCheckedAt = result.checkedAt;
      recordActivity(claim, result);
      return publicClaim(claim);
    },

    async markVerified(id, sessionKey, result) {
      const claim = claims.get(id);
      if (!claim || claim.sessionKey !== sessionKey) {
        throw new Error("Claim not found");
      }

      const owner = [...claims.values()].find(
        (candidate) =>
          candidate.domain === claim.domain &&
          candidate.status === "verified" &&
          candidate.sessionKey !== sessionKey,
      );
      if (owner) return "already_claimed";

      claim.status = "verified";
      claim.verifiedAt ??= result.verifiedAt;
      claim.lastCheckedAt = result.checkedAt;
      claim.latestResult = result;
      recordActivity(claim, result);
      return publicClaim(claim);
    },
  };
}
