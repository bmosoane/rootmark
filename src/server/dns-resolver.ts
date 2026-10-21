import { z } from "zod";

export interface DnsResolver {
  resolveTxt(hostname: string): Promise<string[]>;
}

const dnsJsonResponseSchema = z.object({
  Status: z.number().int(),
  Answer: z
    .array(
      z.object({
        type: z.number().int(),
        data: z.string(),
      }),
    )
    .optional(),
});

function parseTxtValue(value: string): string {
  // DNS JSON represents a long TXT record as adjacent quoted character strings.
  return value
    .replace(/^"|"$/g, "")
    .replace(/"\s+"/g, "")
    .replace(/\\"/g, '"');
}

export const cloudflareDnsResolver: DnsResolver = {
  async resolveTxt(hostname) {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.searchParams.set("name", hostname);
    url.searchParams.set("type", "TXT");

    const response = await fetch(url, {
      headers: { accept: "application/dns-json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`DNS resolver returned ${response.status}`);
    }

    const payload = dnsJsonResponseSchema.parse(await response.json());

    if (payload.Status === 3) return [];
    if (payload.Status !== 0) throw new Error(`DNS status ${payload.Status}`);

    return (payload.Answer ?? [])
      .filter((answer) => answer.type === 16)
      .map((answer) => parseTxtValue(answer.data));
  },
};
