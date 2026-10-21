import type { Claim, StoredCheckResult } from "@/domain/claim";
import { createMemoryClaimsRepository } from "@/server/memory-claims-repository";
import { createNeonClaimsRepository } from "@/server/neon-claims-repository";

export type CreateClaimResult = {
  claim: Claim;
  created: boolean;
};

export type StartCheckResult =
  | { kind: "started"; claim: Claim }
  | { kind: "not_found" }
  | { kind: "rate_limited"; claim: Claim; retryAfterSeconds: number };

export interface ClaimsRepository {
  list(sessionKey: string): Promise<Claim[]>;
  create(sessionKey: string, domain: string): Promise<CreateClaimResult>;
  startCheck(
    id: string,
    sessionKey: string,
    startedAt: string,
    cooldownMs: number,
  ): Promise<StartCheckResult>;
  recordResult(
    id: string,
    sessionKey: string,
    result: StoredCheckResult,
  ): Promise<Claim>;
  markVerified(
    id: string,
    sessionKey: string,
    result: Extract<StoredCheckResult, { kind: "verified" }>,
  ): Promise<Claim | "already_claimed">;
}

const memoryRepository = createMemoryClaimsRepository();
let neonRepository: ClaimsRepository | null = null;
let neonRepositoryUrl: string | null = null;

export function getClaimsRepository(): ClaimsRepository {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production");
    }
    return memoryRepository;
  }

  if (!neonRepository || neonRepositoryUrl !== databaseUrl) {
    neonRepository = createNeonClaimsRepository(databaseUrl);
    neonRepositoryUrl = databaseUrl;
  }

  return neonRepository;
}
