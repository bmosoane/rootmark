import { z } from "zod";
import type {
  ApiErrorResponse,
  CheckClaimResponse,
} from "@/domain/claim-api";
import { getClaimsService } from "@/server/claims-service";
import { getOrCreateSessionKey } from "@/server/session";

const claimIdSchema = z.uuidv4();

export async function POST(
  _request: Request,
  context: RouteContext<"/api/claims/[claimId]/check">,
) {
  const parsedClaimId = claimIdSchema.safeParse((await context.params).claimId);
  if (!parsedClaimId.success) {
    return Response.json(
      { error: "Invalid claim identifier." } satisfies ApiErrorResponse,
      { status: 400 },
    );
  }

  try {
    const sessionKey = await getOrCreateSessionKey();
    const outcome = await getClaimsService().check(
      sessionKey,
      parsedClaimId.data,
    );

    switch (outcome.kind) {
      case "not_found":
        return Response.json(
          { error: "Claim not found." } satisfies ApiErrorResponse,
          { status: 404 },
        );

      case "rate_limited":
        return Response.json(
          {
            result: outcome.result,
            claim: outcome.claim,
          } satisfies CheckClaimResponse,
          {
            status: 429,
            headers: {
              "Retry-After": String(outcome.result.retryAfterSeconds),
            },
          },
        );

      case "completed":
        return Response.json(
          {
            result: outcome.result,
            claim: outcome.claim,
          } satisfies CheckClaimResponse,
          { status: outcome.result.kind === "already_claimed" ? 409 : 200 },
        );

      default:
        throw new Error(
          `Unhandled claim-check outcome: ${JSON.stringify(outcome satisfies never)}`,
        );
    }
  } catch (error) {
    console.error("Failed to check claim", error);
    return Response.json(
      { error: "We could not check this domain." } satisfies ApiErrorResponse,
      { status: 500 },
    );
  }
}
