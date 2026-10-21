import { randomBytes, randomUUID } from "node:crypto";
import { neon, NeonDbError } from "@neondatabase/serverless";
import type { Claim, StoredCheckResult } from "@/domain/claim";
import { storedCheckResultSchema } from "@/domain/claim-schema";
import type { ClaimsRepository } from "@/server/claims-repository";

type DbRow = {
  id: string;
  domain: string;
  token: string;
  status: "pending" | "verified";
  created_at: string | Date;
  last_checked_at: string | Date | null;
  verified_at: string | Date | null;
  latest_result: StoredCheckResult | string | null;
};

function iso(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseStoredResult(
  value: DbRow["latest_result"],
): StoredCheckResult | null {
  if (!value) return null;
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return storedCheckResultSchema.parse(parsed);
}

function fromRow(row: DbRow): Claim {
  return {
    id: row.id,
    domain: row.domain,
    token: row.token,
    status: row.status,
    createdAt: iso(row.created_at)!,
    lastCheckedAt: iso(row.last_checked_at),
    verifiedAt: iso(row.verified_at),
    latestResult: parseStoredResult(row.latest_result),
  };
}

export function createNeonClaimsRepository(
  databaseUrl: string,
): ClaimsRepository {
  const sql = neon(databaseUrl);

  async function findOwned(id: string, sessionKey: string) {
    const rows = await sql`
      SELECT id, domain, token, status, created_at, last_checked_at,
             verified_at, latest_result
      FROM domain_claims
      WHERE id = ${id} AND session_key = ${sessionKey}
      LIMIT 1
    `;
    return rows[0] ? fromRow(rows[0] as DbRow) : null;
  }

  return {
    async list(sessionKey) {
      const rows = await sql`
        SELECT id, domain, token, status, created_at, last_checked_at,
               verified_at, latest_result
        FROM domain_claims
        WHERE session_key = ${sessionKey}
        ORDER BY created_at DESC
      `;
      return (rows as DbRow[]).map(fromRow);
    },

    async create(sessionKey, domain) {
      const id = randomUUID();
      const token = randomBytes(24).toString("base64url");
      const inserted = await sql`
        INSERT INTO domain_claims (id, session_key, domain, token, status)
        VALUES (${id}, ${sessionKey}, ${domain}, ${token}, 'pending')
        ON CONFLICT (session_key, domain) DO NOTHING
        RETURNING id, domain, token, status, created_at, last_checked_at,
                  verified_at, latest_result
      `;

      if (inserted[0]) {
        return { claim: fromRow(inserted[0] as DbRow), created: true };
      }

      // A separate statement gets a fresh snapshot after a concurrent insert wins.
      const existing = await sql`
        SELECT id, domain, token, status, created_at, last_checked_at,
               verified_at, latest_result
        FROM domain_claims
        WHERE session_key = ${sessionKey} AND domain = ${domain}
        LIMIT 1
      `;
      if (!existing[0]) throw new Error("Existing claim not found");
      return { claim: fromRow(existing[0] as DbRow), created: false };
    },

    async startCheck(id, sessionKey, startedAt, cooldownMs) {
      const cutoff = new Date(
        new Date(startedAt).getTime() - cooldownMs,
      ).toISOString();
      // The conditional update acquires the cooldown atomically across requests.
      const rows = await sql`
        UPDATE domain_claims
        SET last_checked_at = ${startedAt}
        WHERE id = ${id}
          AND session_key = ${sessionKey}
          AND (last_checked_at IS NULL OR last_checked_at <= ${cutoff})
        RETURNING id, domain, token, status, created_at, last_checked_at,
                  verified_at, latest_result
      `;

      if (rows[0]) {
        return { kind: "started", claim: fromRow(rows[0] as DbRow) };
      }

      const claim = await findOwned(id, sessionKey);
      if (!claim) return { kind: "not_found" };

      const elapsed = claim.lastCheckedAt
        ? new Date(startedAt).getTime() - new Date(claim.lastCheckedAt).getTime()
        : cooldownMs;
      return {
        kind: "rate_limited",
        claim,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((cooldownMs - elapsed) / 1000),
        ),
      };
    },

    async recordResult(id, sessionKey, result) {
      const rows = await sql`
        UPDATE domain_claims
        SET latest_result = ${JSON.stringify(result)}::jsonb,
            last_checked_at = ${result.checkedAt}
        WHERE id = ${id} AND session_key = ${sessionKey}
        RETURNING id, domain, token, status, created_at, last_checked_at,
                  verified_at, latest_result
      `;
      if (!rows[0]) throw new Error("Claim not found");
      return fromRow(rows[0] as DbRow);
    },

    async markVerified(id, sessionKey, result) {
      try {
        const rows = await sql`
          UPDATE domain_claims
          SET status = 'verified',
              latest_result = ${JSON.stringify(result)}::jsonb,
              last_checked_at = ${result.checkedAt},
              verified_at = ${result.verifiedAt}
          WHERE id = ${id} AND session_key = ${sessionKey}
          RETURNING id, domain, token, status, created_at, last_checked_at,
                    verified_at, latest_result
        `;
        if (!rows[0]) throw new Error("Claim not found");
        return fromRow(rows[0] as DbRow);
      } catch (error) {
        if (
          error instanceof NeonDbError &&
          error.code === "23505" &&
          error.constraint === "one_verified_claim_per_domain"
        ) {
          return "already_claimed";
        }
        throw error;
      }
    },
  };
}
