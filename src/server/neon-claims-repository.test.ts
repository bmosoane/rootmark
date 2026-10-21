import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimLimitError } from "./claims-policy";
import { createNeonClaimsRepository } from "./neon-claims-repository";

const database = vi.hoisted(() => {
  class MockNeonDbError extends Error {
    code?: string;
    constraint?: string;
  }

  return {
    connect: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
    NeonDbError: MockNeonDbError,
  };
});

vi.mock("@neondatabase/serverless", () => ({
  neon: database.connect,
  NeonDbError: database.NeonDbError,
}));

const existingRow = {
  id: "643f14c8-54d6-4bb7-9088-cfd8b79bfbef",
  domain: "example.com",
  token: "existing-token",
  status: "pending",
  created_at: "2026-10-21T10:00:00.000Z",
  last_checked_at: null,
  verified_at: null,
  latest_result: null,
  verification_activity: [],
};

const verifiedResult = {
  kind: "verified" as const,
  checkedAt: "2026-10-21T11:00:00.000Z",
  verifiedAt: "2026-10-21T11:00:00.000Z",
};

function queryText(callIndex = 0) {
  const strings = database.query.mock.calls[callIndex]?.[0] as
    | TemplateStringsArray
    | undefined;
  return strings?.join("?").replace(/\s+/g, " ").trim() ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  database.transaction.mockImplementation(async (queries) =>
    Promise.all(queries),
  );
  database.connect.mockReturnValue(
    Object.assign(database.query, { transaction: database.transaction }),
  );
});

describe("Neon claims repository", () => {
  it("reads an existing claim in a new statement after an insert conflict", async () => {
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([existingRow]);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    const result = await repository.create("session-key", "example.com");

    expect(result).toEqual({
      claim: {
        id: existingRow.id,
        domain: "example.com",
        token: "existing-token",
        status: "pending",
        createdAt: "2026-10-21T10:00:00.000Z",
        lastCheckedAt: null,
        verifiedAt: null,
        latestResult: null,
        verificationActivity: [],
      },
      created: false,
    });
    expect(database.query).toHaveBeenCalledTimes(3);
    expect(queryText(0)).toContain("pg_advisory_xact_lock");
    expect(queryText(1)).toContain("SELECT COUNT(*)");
  });

  it("rejects a new claim when the session limit is reached", async () => {
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    await expect(
      repository.create("session-key", "one-too-many.example"),
    ).rejects.toBeInstanceOf(ClaimLimitError);
  });

  it("reports whether an owned claim was removed", async () => {
    database.query.mockResolvedValueOnce([{ id: existingRow.id }]);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    await expect(
      repository.remove(existingRow.id, "session-key"),
    ).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it("returns the active cooldown when the atomic update does not start", async () => {
    database.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          ...existingRow,
          last_checked_at: "2026-10-21T10:00:00.000Z",
        },
      ]);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    await expect(
      repository.startCheck(
        existingRow.id,
        "session-key",
        "2026-10-21T10:00:05.000Z",
        10_000,
      ),
    ).resolves.toMatchObject({
      kind: "rate_limited",
      retryAfterSeconds: 5,
    });
    expect(queryText(0)).toContain("last_checked_at <= ?");
  });

  it("deduplicates and caps persisted verification activity", async () => {
    const result = {
      kind: "not_found" as const,
      checkedAt: "2026-10-21T10:00:00.000Z",
    };
    database.query.mockResolvedValueOnce([
      {
        ...existingRow,
        last_checked_at: result.checkedAt,
        latest_result: result,
        verification_activity: [
          { kind: result.kind, observedAt: result.checkedAt },
        ],
      },
    ]);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    await repository.recordResult(existingRow.id, "session-key", result);

    expect(queryText()).toContain(
      "WHEN verification_activity->-1->>'kind' = ?",
    );
    expect(queryText()).toContain(
      "WHEN jsonb_array_length(verification_activity) >= 20",
    );
  });

  it("preserves the first verification timestamp", async () => {
    const firstVerifiedAt = "2026-10-21T10:30:00.000Z";
    database.query.mockResolvedValueOnce([
      {
        ...existingRow,
        status: "verified",
        last_checked_at: verifiedResult.checkedAt,
        verified_at: firstVerifiedAt,
        latest_result: verifiedResult,
        verification_activity: [
          { kind: "verified", observedAt: firstVerifiedAt },
        ],
      },
    ]);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    const claim = await repository.markVerified(
      existingRow.id,
      "session-key",
      verifiedResult,
    );

    expect(claim).toMatchObject({ verifiedAt: firstVerifiedAt });
    expect(queryText()).toContain(
      "verified_at = COALESCE(verified_at, ?)",
    );
  });

  it("maps the verified-owner constraint to an ownership conflict", async () => {
    const conflict = new database.NeonDbError("unique violation");
    conflict.code = "23505";
    conflict.constraint = "one_verified_claim_per_domain";
    database.query.mockRejectedValueOnce(conflict);
    const repository = createNeonClaimsRepository("postgresql://example.test/db");

    await expect(
      repository.markVerified(
        existingRow.id,
        "session-key",
        verifiedResult,
      ),
    ).resolves.toBe("already_claimed");
  });
});
