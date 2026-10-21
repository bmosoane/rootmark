import { randomBytes, randomUUID } from "node:crypto";
import { neon, NeonDbError } from "@neondatabase/serverless";
import { activityEventFor } from "@/domain/claim";
import type { Claim, StoredCheckResult } from "@/domain/claim";
import {
  storedCheckResultSchema,
  verificationActivitySchema,
} from "@/domain/claim-schema";
import {
  ClaimLimitError,
  MAX_CLAIMS_PER_SESSION,
} from "@/server/claims-policy";
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
  verification_activity: unknown;
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
    verificationActivity: verificationActivitySchema.parse(
      typeof row.verification_activity === "string"
        ? JSON.parse(row.verification_activity)
        : row.verification_activity,
    ),
  };
}

export function createNeonClaimsRepository(
  databaseUrl: string,
): ClaimsRepository {
  const sql = neon(databaseUrl);

  async function findOwned(id: string, sessionKey: string) {
    const rows = await sql`
      SELECT id, domain, token, status, created_at, last_checked_at,
             verified_at, latest_result, verification_activity
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
               verified_at, latest_result, verification_activity
        FROM domain_claims
        WHERE session_key = ${sessionKey}
        ORDER BY created_at DESC
      `;
      return (rows as DbRow[]).map(fromRow);
    },

    async create(sessionKey, domain) {
      const id = randomUUID();
      const token = randomBytes(24).toString("base64url");
      const [, inserted] = await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${sessionKey}, 0))`,
        sql`
          INSERT INTO domain_claims (id, session_key, domain, token, status)
          SELECT ${id}, ${sessionKey}, ${domain}, ${token}, 'pending'
          WHERE (
            SELECT COUNT(*)
            FROM domain_claims
            WHERE session_key = ${sessionKey}
          ) < ${MAX_CLAIMS_PER_SESSION}
          ON CONFLICT (session_key, domain) DO NOTHING
          RETURNING id, domain, token, status, created_at, last_checked_at,
                    verified_at, latest_result, verification_activity
        `,
      ]);

      if (inserted[0]) {
        return { claim: fromRow(inserted[0] as DbRow), created: true };
      }

      // A separate statement gets a fresh snapshot after a concurrent insert wins.
      const existing = await sql`
        SELECT id, domain, token, status, created_at, last_checked_at,
               verified_at, latest_result, verification_activity
        FROM domain_claims
        WHERE session_key = ${sessionKey} AND domain = ${domain}
        LIMIT 1
      `;
      if (!existing[0]) throw new ClaimLimitError();
      return { claim: fromRow(existing[0] as DbRow), created: false };
    },

    async remove(id, sessionKey) {
      const rows = await sql`
        DELETE FROM domain_claims
        WHERE id = ${id} AND session_key = ${sessionKey}
        RETURNING id
      `;
      return Boolean(rows[0]);
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
                  verified_at, latest_result, verification_activity
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
      const activity = JSON.stringify([activityEventFor(result)]);
      const rows = await sql`
        UPDATE domain_claims
        SET latest_result = ${JSON.stringify(result)}::jsonb,
            last_checked_at = ${result.checkedAt},
            verification_activity = CASE
              WHEN verification_activity->-1->>'kind' = ${result.kind}
                THEN verification_activity
              ELSE (
                CASE
                  WHEN jsonb_array_length(verification_activity) >= 20
                    THEN verification_activity - 0
                  ELSE verification_activity
                END
              ) || ${activity}::jsonb
            END
        WHERE id = ${id} AND session_key = ${sessionKey}
        RETURNING id, domain, token, status, created_at, last_checked_at,
                  verified_at, latest_result, verification_activity
      `;
      if (!rows[0]) throw new Error("Claim not found");
      return fromRow(rows[0] as DbRow);
    },

    async markVerified(id, sessionKey, result) {
      const activity = JSON.stringify([activityEventFor(result)]);
      try {
        const rows = await sql`
          UPDATE domain_claims
          SET status = 'verified',
              latest_result = ${JSON.stringify(result)}::jsonb,
              last_checked_at = ${result.checkedAt},
              verified_at = COALESCE(verified_at, ${result.verifiedAt}),
              verification_activity = CASE
                WHEN verification_activity->-1->>'kind' = ${result.kind}
                  THEN verification_activity
                ELSE (
                  CASE
                    WHEN jsonb_array_length(verification_activity) >= 20
                      THEN verification_activity - 0
                    ELSE verification_activity
                  END
                ) || ${activity}::jsonb
              END
          WHERE id = ${id} AND session_key = ${sessionKey}
          RETURNING id, domain, token, status, created_at, last_checked_at,
                    verified_at, latest_result, verification_activity
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
