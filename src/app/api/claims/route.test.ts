import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Claim } from "@/domain/claim";
import { GET, POST } from "./route";
import { POST as CHECK } from "./[claimId]/check/route";

const mocks = vi.hoisted(() => ({
  getSessionKey: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  check: vi.fn(),
}));

vi.mock("@/server/session", () => ({
  getOrCreateSessionKey: mocks.getSessionKey,
}));

vi.mock("@/server/claims-service", () => ({
  getClaimsService: () => ({
    list: mocks.list,
    create: mocks.create,
    check: mocks.check,
  }),
}));

const claim: Claim = {
  id: "643f14c8-54d6-4bb7-9088-cfd8b79bfbef",
  domain: "example.com",
  token: "token",
  status: "pending",
  createdAt: "2026-10-21T10:00:00.000Z",
  lastCheckedAt: null,
  verifiedAt: null,
  latestResult: null,
  verificationActivity: [],
};

function createRequest(body: unknown) {
  return new Request("http://localhost/api/claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function checkRequest(claimId = claim.id) {
  const request = new Request(`http://localhost/api/claims/${claimId}/check`, {
    method: "POST",
  });
  const context = { params: Promise.resolve({ claimId }) };
  return CHECK(request, context as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionKey.mockResolvedValue("session-key");
});

describe("claims routes", () => {
  it("lists only the current session's claims without caching", async () => {
    mocks.list.mockResolvedValue([claim]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ claims: [claim] });
    expect(mocks.list).toHaveBeenCalledWith("session-key");
  });

  it("rejects malformed create bodies at the request boundary", async () => {
    const response = await POST(createRequest({ domain: 42 }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("distinguishes newly created and existing claims", async () => {
    mocks.create
      .mockResolvedValueOnce({ claim, created: true })
      .mockResolvedValueOnce({ claim, created: false });

    const created = await POST(createRequest({ domain: "example.com" }));
    const existing = await POST(createRequest({ domain: "example.com" }));

    expect(created.status).toBe(201);
    expect(existing.status).toBe(200);
  });

  it("rejects malformed claim identifiers", async () => {
    const response = await checkRequest("not-a-uuid");

    expect(response.status).toBe(400);
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("does not disclose claims outside the current session", async () => {
    mocks.check.mockResolvedValue({ kind: "not_found" });

    const response = await checkRequest();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Claim not found.",
    });
  });

  it("returns cooldown metadata through HTTP headers and body", async () => {
    mocks.check.mockResolvedValue({
      kind: "rate_limited",
      claim,
      result: { kind: "rate_limited", retryAfterSeconds: 7 },
    });

    const response = await checkRequest();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    await expect(response.json()).resolves.toMatchObject({
      result: { kind: "rate_limited", retryAfterSeconds: 7 },
    });
  });

  it("returns a conflict without disclosing the existing owner", async () => {
    mocks.check.mockResolvedValue({
      kind: "completed",
      claim,
      result: {
        kind: "already_claimed",
        checkedAt: "2026-10-21T10:00:00.000Z",
      },
    });

    const response = await checkRequest();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.not.toHaveProperty("owner");
  });
});
