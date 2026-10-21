import { describe, expect, it } from "vitest";
import type { DnsCheckResult } from "@/domain/claim";
import {
  ClaimLimitError,
  MAX_CLAIMS_PER_SESSION,
} from "./claims-policy";
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

  it("caps claims per session without blocking existing domains", async () => {
    const repository = createMemoryClaimsRepository();
    for (let index = 0; index < MAX_CLAIMS_PER_SESSION; index += 1) {
      await repository.create("session-a", `domain-${index}.example`);
    }

    await expect(
      repository.create("session-a", "one-too-many.example"),
    ).rejects.toBeInstanceOf(ClaimLimitError);
    await expect(
      repository.create("session-a", "domain-0.example"),
    ).resolves.toMatchObject({ created: false });
    await expect(
      repository.create("session-b", "another.example"),
    ).resolves.toMatchObject({ created: true });
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

  it("removes only a claim owned by the current session", async () => {
    const repository = createMemoryClaimsRepository();
    const { claim } = await repository.create("session-a", "example.com");

    await expect(repository.remove(claim.id, "session-b")).resolves.toBe(false);
    await expect(repository.remove(claim.id, "session-a")).resolves.toBe(true);
    await expect(repository.list("session-a")).resolves.toEqual([]);
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

  it("preserves the original verification timestamp on repeated verification", async () => {
    const repository = createMemoryClaimsRepository();
    const { claim } = await repository.create("session-a", "example.com");
    const laterResult: DnsCheckResult = {
      kind: "verified",
      checkedAt: "2026-10-21T11:00:00.000Z",
      verifiedAt: "2026-10-21T11:00:00.000Z",
    };

    await repository.markVerified(claim.id, "session-a", verifiedResult);
    const repeated = await repository.markVerified(
      claim.id,
      "session-a",
      laterResult,
    );

    expect(repeated).toMatchObject({
      verifiedAt: verifiedResult.verifiedAt,
      lastCheckedAt: laterResult.checkedAt,
    });
  });

  it("records meaningful transitions without repeating identical outcomes", async () => {
    const repository = createMemoryClaimsRepository();
    const { claim } = await repository.create("session-a", "example.com");
    const firstMissing = {
      kind: "not_found",
      checkedAt: "2026-10-21T10:00:00.000Z",
    } as const;
    const secondMissing = {
      kind: "not_found",
      checkedAt: "2026-10-21T10:01:00.000Z",
    } as const;

    await repository.recordResult(claim.id, "session-a", firstMissing);
    const repeated = await repository.recordResult(
      claim.id,
      "session-a",
      secondMissing,
    );
    const verified = await repository.markVerified(
      claim.id,
      "session-a",
      verifiedResult,
    );

    expect(repeated.verificationActivity).toEqual([
      { kind: "not_found", observedAt: firstMissing.checkedAt },
    ]);
    expect(verified).toMatchObject({
      verificationActivity: [
        { kind: "not_found", observedAt: firstMissing.checkedAt },
        { kind: "verified", observedAt: verifiedResult.checkedAt },
      ],
    });
  });
});
