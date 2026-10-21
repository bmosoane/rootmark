import { z } from "zod";
import { InvalidDomainError } from "@/domain/domain-name";
import { getClaimsService } from "@/server/claims-service";
import { getOrCreateSessionKey } from "@/server/session";

const createClaimSchema = z.object({ domain: z.string().max(300) });

export async function GET() {
  try {
    const sessionKey = await getOrCreateSessionKey();
    const claims = await getClaimsService().list(sessionKey);
    return Response.json(
      { claims },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to list claims", error);
    return Response.json(
      { error: "We could not load your domains." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const parsed = createClaimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a domain to continue." },
      { status: 400 },
    );
  }

  try {
    const sessionKey = await getOrCreateSessionKey();
    const result = await getClaimsService().create(
      sessionKey,
      parsed.data.domain,
    );
    return Response.json(
      { claim: result.claim },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof InvalidDomainError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create claim", error);
    return Response.json(
      { error: "We could not add this domain." },
      { status: 500 },
    );
  }
}
