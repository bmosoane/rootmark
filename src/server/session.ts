import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

const SESSION_COOKIE = "rootmark_session";
const sessionIdSchema = z.uuidv4();

function sessionKey(sessionId: string): string {
  // Persist only a one-way key so the bearer cookie never reaches storage.
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function getOrCreateSessionKey(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;

  if (existing && sessionIdSchema.safeParse(existing).success) {
    return sessionKey(existing);
  }

  const sessionId = randomUUID();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  });

  return sessionKey(sessionId);
}
