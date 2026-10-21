import { z } from "zod";

const verifiedCheckResultSchema = z.object({
  kind: z.literal("verified"),
  checkedAt: z.string(),
  verifiedAt: z.string(),
});

const notFoundCheckResultSchema = z.object({
  kind: z.literal("not_found"),
  checkedAt: z.string(),
});

const wrongValueCheckResultSchema = z.object({
  kind: z.literal("wrong_value"),
  checkedAt: z.string(),
  observed: z.array(z.string()),
});

const wrongHostCheckResultSchema = z.object({
  kind: z.literal("wrong_host"),
  checkedAt: z.string(),
  observedAt: z.string(),
});

const lookupFailedCheckResultSchema = z.object({
  kind: z.literal("lookup_failed"),
  checkedAt: z.string(),
  retryable: z.literal(true),
});

const alreadyClaimedCheckResultSchema = z.object({
  kind: z.literal("already_claimed"),
  checkedAt: z.string(),
});

export const dnsCheckResultSchema = z.discriminatedUnion("kind", [
  verifiedCheckResultSchema,
  notFoundCheckResultSchema,
  wrongValueCheckResultSchema,
  wrongHostCheckResultSchema,
  lookupFailedCheckResultSchema,
]);

export const storedCheckResultSchema = z.discriminatedUnion("kind", [
  verifiedCheckResultSchema,
  notFoundCheckResultSchema,
  wrongValueCheckResultSchema,
  wrongHostCheckResultSchema,
  lookupFailedCheckResultSchema,
  alreadyClaimedCheckResultSchema,
]);

export const verificationActivityEventSchema = z.object({
  kind: z.enum([
    "verified",
    "not_found",
    "wrong_value",
    "wrong_host",
    "lookup_failed",
    "already_claimed",
  ]),
  observedAt: z.string(),
});

export const verificationActivitySchema = z.array(
  verificationActivityEventSchema,
);

export type DnsCheckResult = z.infer<typeof dnsCheckResultSchema>;

export type StoredCheckResult = z.infer<typeof storedCheckResultSchema>;

export type VerificationActivityEvent = z.infer<
  typeof verificationActivityEventSchema
>;
