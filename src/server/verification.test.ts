import { describe, expect, it } from "vitest";
import type { Claim } from "@/domain/claim";
import type { DnsResolver } from "./dns-resolver";
import { verifyClaim } from "./verification";

const claim: Claim = {
  id: "claim-1",
  domain: "example.com",
  token: "secret-token",
  status: "pending",
  createdAt: "2026-10-21T00:00:00.000Z",
  lastCheckedAt: null,
  verifiedAt: null,
  latestResult: null,
  verificationActivity: [],
};

function resolver(values: Record<string, string[]>): DnsResolver {
  return {
    async resolveTxt(hostname) {
      return values[hostname] ?? [];
    },
  };
}

describe("verifyClaim", () => {
  it("verifies only the exact claim token", async () => {
    const result = await verifyClaim(
      claim,
      resolver({ "_rootmark.example.com": ["rootmark=secret-token"] }),
    );
    expect(result.kind).toBe("verified");
  });

  it("reports observed values without treating them as proof", async () => {
    const result = await verifyClaim(
      claim,
      resolver({ "_rootmark.example.com": ["rootmark=someone-else"] }),
    );
    expect(result).toMatchObject({
      kind: "wrong_value",
      observed: ["rootmark=someone-else"],
    });
  });

  it("diagnoses a provider that appended the domain twice", async () => {
    const result = await verifyClaim(
      claim,
      resolver({
        "_rootmark.example.com.example.com": ["rootmark=secret-token"],
      }),
    );
    expect(result).toMatchObject({
      kind: "wrong_host",
      observedAt: "_rootmark.example.com.example.com",
    });
  });

  it("distinguishes absence from an infrastructure failure", async () => {
    const notFound = await verifyClaim(claim, resolver({}));
    const failed = await verifyClaim(claim, {
      async resolveTxt() {
        throw new Error("resolver unavailable");
      },
    });
    expect(notFound.kind).toBe("not_found");
    expect(failed.kind).toBe("lookup_failed");
  });

  it("accepts primary proof even when the diagnostic lookup fails", async () => {
    const result = await verifyClaim(claim, {
      async resolveTxt(hostname) {
        if (hostname === "_rootmark.example.com") {
          return ["rootmark=secret-token"];
        }
        throw new Error("diagnostic lookup unavailable");
      },
    });

    expect(result.kind).toBe("verified");
  });

  it("does not treat an optional diagnostic failure as primary failure", async () => {
    const result = await verifyClaim(claim, {
      async resolveTxt(hostname) {
        if (hostname === "_rootmark.example.com") return [];
        throw new Error("diagnostic lookup unavailable");
      },
    });

    expect(result.kind).toBe("not_found");
  });
});
