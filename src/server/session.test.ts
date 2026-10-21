import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateSessionKey } from "./session";

const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStore),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("anonymous session boundary", () => {
  it("hashes a valid opaque cookie before persistence", async () => {
    cookieStore.get.mockReturnValue({
      value: "643f14c8-54d6-4bb7-9088-cfd8b79bfbef",
    });

    const key = await getOrCreateSessionKey();

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("643f14c8");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("replaces malformed session cookies", async () => {
    cookieStore.get.mockReturnValue({ value: "attacker-controlled-value" });

    const key = await getOrCreateSessionKey();

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "rootmark_session",
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });
});
