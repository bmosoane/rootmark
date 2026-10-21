import type { CheckResult, Claim, StoredCheckResult } from "@/domain/claim";
import { normalizeDomain } from "@/domain/domain-name";
import type { ClaimsRepository } from "@/server/claims-repository";
import { getClaimsRepository } from "@/server/claims-repository";
import type { DnsResolver } from "@/server/dns-resolver";
import { cloudflareDnsResolver } from "@/server/dns-resolver";
import { verifyClaim } from "@/server/verification";

const CHECK_COOLDOWN_MS = 10_000;

export type CheckClaimOutcome =
  | { kind: "not_found" }
  | {
      kind: "rate_limited";
      claim: Claim;
      result: Extract<CheckResult, { kind: "rate_limited" }>;
    }
  | { kind: "completed"; claim: Claim; result: StoredCheckResult };

type ClaimsServiceDependencies = {
  repository: ClaimsRepository;
  resolver: DnsResolver;
  now?: () => Date;
};

export function createClaimsService({
  repository,
  resolver,
  now = () => new Date(),
}: ClaimsServiceDependencies) {
  return {
    list(sessionKey: string) {
      return repository.list(sessionKey);
    },

    create(sessionKey: string, input: string) {
      return repository.create(sessionKey, normalizeDomain(input));
    },

    async check(
      sessionKey: string,
      claimId: string,
    ): Promise<CheckClaimOutcome> {
      const checkedAt = now().toISOString();
      const start = await repository.startCheck(
        claimId,
        sessionKey,
        checkedAt,
        CHECK_COOLDOWN_MS,
      );

      if (start.kind === "not_found") return start;
      if (start.kind === "rate_limited") {
        return {
          kind: "rate_limited",
          claim: start.claim,
          result: {
            kind: "rate_limited",
            retryAfterSeconds: start.retryAfterSeconds,
          },
        };
      }

      const result = await verifyClaim(
        start.claim,
        resolver,
        () => new Date(checkedAt),
      );

      if (result.kind !== "verified") {
        const claim = await repository.recordResult(
          claimId,
          sessionKey,
          result,
        );
        return { kind: "completed", result, claim };
      }

      const verified = await repository.markVerified(
        claimId,
        sessionKey,
        result,
      );
      if (verified !== "already_claimed") {
        return { kind: "completed", result, claim: verified };
      }

      const conflict = {
        kind: "already_claimed",
        checkedAt: result.checkedAt,
      } as const;
      const claim = await repository.recordResult(
        claimId,
        sessionKey,
        conflict,
      );
      return { kind: "completed", result: conflict, claim };
    },
  };
}

export function getClaimsService() {
  return createClaimsService({
    repository: getClaimsRepository(),
    resolver: cloudflareDnsResolver,
  });
}
