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
  logger?: Pick<Console, "info">;
};

const defaultLogger: Pick<Console, "info"> = console;

export function createClaimsService({
  repository,
  resolver,
  now = () => new Date(),
  logger = defaultLogger,
}: ClaimsServiceDependencies) {
  return {
    list(sessionKey: string) {
      return repository.list(sessionKey);
    },

    create(sessionKey: string, input: string) {
      return repository.create(sessionKey, normalizeDomain(input));
    },

    async remove(sessionKey: string, claimId: string) {
      const removed = await repository.remove(claimId, sessionKey);
      logger.info("claim_remove", {
        claimId,
        outcome: removed ? "removed" : "not_found",
      });
      return removed;
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

      if (start.kind === "not_found") {
        logger.info("claim_check", { claimId, outcome: "not_found" });
        return start;
      }
      if (start.kind === "rate_limited") {
        logger.info("claim_check", { claimId, outcome: "rate_limited" });
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
        logger.info("claim_check", { claimId, outcome: result.kind });
        return { kind: "completed", result, claim };
      }

      const verified = await repository.markVerified(
        claimId,
        sessionKey,
        result,
      );
      if (verified !== "already_claimed") {
        logger.info("claim_check", { claimId, outcome: result.kind });
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
      logger.info("claim_check", { claimId, outcome: conflict.kind });
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
