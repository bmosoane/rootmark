import type { CheckResult, Claim } from "@/domain/claim";

export type ApiErrorResponse = { error: string };

export type ListClaimsResponse = { claims: Claim[] };

export type CreateClaimResponse = { claim: Claim };

export type CheckClaimResponse = {
  claim: Claim;
  result: CheckResult;
};

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}
