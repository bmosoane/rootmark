import type { Claim, DnsCheckResult } from "@/domain/claim";
import { challengeFor } from "@/domain/claim";
import type { DnsResolver } from "@/server/dns-resolver";

export async function verifyClaim(
  claim: Claim,
  resolver: DnsResolver,
  now: () => Date = () => new Date(),
): Promise<DnsCheckResult> {
  const checkedAt = now().toISOString();
  const challenge = challengeFor(claim);
  // Diagnose the common case where a DNS provider appends the domain twice.
  const duplicatedHost = `${challenge.fqdn}.${claim.domain}`;

  const [expectedLookup, duplicatedLookup] = await Promise.allSettled([
    resolver.resolveTxt(challenge.fqdn),
    resolver.resolveTxt(duplicatedHost),
  ]);

  if (expectedLookup.status === "rejected") {
    return { kind: "lookup_failed", checkedAt, retryable: true };
  }

  const expectedValues = expectedLookup.value;
  if (expectedValues.includes(challenge.value)) {
    return {
      kind: "verified",
      checkedAt,
      verifiedAt: checkedAt,
    };
  }

  if (expectedValues.length > 0) {
    return { kind: "wrong_value", checkedAt, observed: expectedValues };
  }

  if (
    duplicatedLookup.status === "fulfilled" &&
    duplicatedLookup.value.includes(challenge.value)
  ) {
    return { kind: "wrong_host", checkedAt, observedAt: duplicatedHost };
  }

  return { kind: "not_found", checkedAt };
}
