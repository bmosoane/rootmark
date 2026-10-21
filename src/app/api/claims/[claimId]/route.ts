import { z } from "zod";
import type { ApiErrorResponse } from "@/domain/claim-api";
import { getClaimsService } from "@/server/claims-service";
import { getOrCreateSessionKey } from "@/server/session";

const claimIdSchema = z.uuidv4();

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/claims/[claimId]">,
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
    const removed = await getClaimsService().remove(
      sessionKey,
      parsedClaimId.data,
    );

    if (!removed) {
      return Response.json(
        { error: "Claim not found." } satisfies ApiErrorResponse,
        { status: 404 },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove claim", error);
    return Response.json(
      { error: "We could not remove this domain." } satisfies ApiErrorResponse,
      { status: 500 },
    );
  }
}
