import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNeonClaimsRepository } from "./neon-claims-repository";

const database = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: database.connect,
  NeonDbError: class NeonDbError extends Error {},
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
};

beforeEach(() => {
  vi.clearAllMocks();
  database.connect.mockReturnValue(database.query);
});

describe("Neon claims repository", () => {
  it("reads an existing claim in a new statement after an insert conflict", async () => {
    database.query
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
      },
      created: false,
    });
    expect(database.query).toHaveBeenCalledTimes(2);
  });
});
