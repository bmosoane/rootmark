import { describe, expect, it } from "vitest";
import { challengeFor } from "@/domain/claim";
import { createClaimsService } from "./claims-service";
import type { DnsResolver } from "./dns-resolver";
import { createMemoryClaimsRepository } from "./memory-claims-repository";

describe("claims service", () => {
  it("normalizes domains before creating a claim", async () => {
    const repository = createMemoryClaimsRepository();
    const service = createClaimsService({
      repository,
      resolver: { async resolveTxt() { return []; } },
    });

    const result = await service.create("session-a", " Example.COM. ");

    expect(result.claim.domain).toBe("example.com");
  });

  it("verifies exact DNS proof and persists the ownership state", async () => {
    const repository = createMemoryClaimsRepository();
    let expectedHost = "";
    let expectedValue = "";
    const resolver: DnsResolver = {
      async resolveTxt(hostname) {
        return hostname === expectedHost ? [expectedValue] : [];
      },
    };
    const service = createClaimsService({
      repository,
      resolver,
      now: () => new Date("2026-10-21T10:00:00.000Z"),
    });
    const created = await service.create("session-a", "example.com");
    const challenge = challengeFor(created.claim);
    expectedHost = challenge.fqdn;
    expectedValue = challenge.value;

    const outcome = await service.check("session-a", created.claim.id);

    expect(outcome).toMatchObject({
      kind: "completed",
      result: { kind: "verified" },
      claim: { status: "verified" },
    });
  });

  it("rate-limits repeated checks without calling DNS again", async () => {
    const repository = createMemoryClaimsRepository();
    let lookups = 0;
    const service = createClaimsService({
      repository,
      resolver: {
        async resolveTxt() {
          lookups += 1;
          return [];
        },
      },
      now: () => new Date("2026-10-21T10:00:00.000Z"),
    });
    const created = await service.create("session-a", "example.com");

    await service.check("session-a", created.claim.id);
    const second = await service.check("session-a", created.claim.id);

    expect(second).toMatchObject({
      kind: "rate_limited",
      result: { retryAfterSeconds: 10 },
    });
    expect(lookups).toBe(2);
  });
});
