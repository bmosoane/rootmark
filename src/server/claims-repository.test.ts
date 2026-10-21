import { describe, expect, it } from "vitest";
import type { DnsCheckResult } from "@/domain/claim";
import { createMemoryClaimsRepository } from "./memory-claims-repository";

const verifiedResult: DnsCheckResult = {
  kind: "verified",
  checkedAt: "2026-10-21T10:00:00.000Z",
  verifiedAt: "2026-10-21T10:00:00.000Z",
};

describe("memory claims repository contract", () => {
  it("returns an existing claim for the same session and domain", async () => {
    const repository = createMemoryClaimsRepository();
    const first = await repository.create("session-a", "example.com");
    const second = await repository.create("session-a", "example.com");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.claim.id).toBe(first.claim.id);
  });

  it("isolates claims by session", async () => {
    const repository = createMemoryClaimsRepository();
    const { claim } = await repository.create("session-a", "example.com");

    await expect(repository.list("session-b")).resolves.toEqual([]);
    await expect(
      repository.startCheck(
        claim.id,
        "session-b",
        "2026-10-21T10:00:00.000Z",
        10_000,
      ),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("acquires a check cooldown atomically", async () => {
    const repository = createMemoryClaimsRepository();
    const { claim } = await repository.create("session-a", "example.com");
    const startedAt = "2026-10-21T10:00:00.000Z";

    await expect(
      repository.startCheck(claim.id, "session-a", startedAt, 10_000),
    ).resolves.toMatchObject({ kind: "started" });
    await expect(
      repository.startCheck(claim.id, "session-a", startedAt, 10_000),
    ).resolves.toMatchObject({
      kind: "rate_limited",
      retryAfterSeconds: 10,
    });
  });

  it("allows only one verified owner for a domain", async () => {
    const repository = createMemoryClaimsRepository();
    const first = await repository.create("session-a", "example.com");
    const second = await repository.create("session-b", "example.com");

    await expect(
      repository.markVerified(first.claim.id, "session-a", verifiedResult),
    ).resolves.toMatchObject({ status: "verified" });
    await expect(
      repository.markVerified(second.claim.id, "session-b", verifiedResult),
    ).resolves.toBe("already_claimed");
  });
});
