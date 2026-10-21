import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudflareDnsResolver } from "./dns-resolver";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cloudflare DNS resolver", () => {
  it("parses and joins segmented TXT values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          Status: 0,
          Answer: [{ type: 16, data: '"rootmark=abc" "def"' }],
        }),
      ),
    );

    await expect(
      cloudflareDnsResolver.resolveTxt("_rootmark.example.com"),
    ).resolves.toEqual(["rootmark=abcdef"]);
  });

  it("maps NXDOMAIN to an empty observation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ Status: 3 })),
    );

    await expect(
      cloudflareDnsResolver.resolveTxt("_rootmark.example.com"),
    ).resolves.toEqual([]);
  });

  it("rejects malformed resolver responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ Status: "NOERROR" })),
    );

    await expect(
      cloudflareDnsResolver.resolveTxt("_rootmark.example.com"),
    ).rejects.toThrow();
  });
});
