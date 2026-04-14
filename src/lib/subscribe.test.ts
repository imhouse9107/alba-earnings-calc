/**
 * Tests for api/subscribe.ts handler.
 *
 * (c) Supabase failure does not prevent subscribe returning 200.
 * (d) Happy path: valid email + EO success => 200 + insertSubmission called.
 * (e) Missing API key => 500 before any external I/O.
 *
 * Note on mock ordering: vi.mock calls are hoisted by vitest to the top of
 * the module before any imports, so they intercept subscribe.ts's internal
 * imports of _supabase and _email-validator correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { insertSubmission } from "../../api/_supabase.js";
import { validateEmail } from "../../api/_email-validator.js";

// Hoisted mocks - intercept what subscribe.ts imports internally
vi.mock("../../api/_supabase.js", () => ({
  insertSubmission: vi.fn(),
}));

vi.mock("../../api/_email-validator.js", () => ({
  validateEmail: vi.fn(),
}));

// Import handler AFTER mock declarations (hoisting makes this safe)
import handler from "../../api/subscribe.js";

beforeEach(() => {
  process.env.EMAILOCTOPUS_API_KEY = "test-api-key";
  process.env.EMAILOCTOPUS_CALC_LIST_ID = "test-list-id";

  // Default: email passes validation, Supabase succeeds, EO succeeds
  vi.mocked(validateEmail).mockResolvedValue({ valid: true });
  vi.mocked(insertSubmission).mockResolvedValue(undefined);

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.EMAILOCTOPUS_API_KEY;
  delete process.env.EMAILOCTOPUS_CALC_LIST_ID;
});

/** Minimal mock req/res matching VercelRequest/VercelResponse shape */
function mockReqRes(email = "candidate@bbc.co.uk") {
  let statusCode = 0;
  let responseBody: unknown = null;
  const req = { method: "POST", body: { email }, headers: {} };
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; return this; },
  };
  return { req, res, getStatus: () => statusCode, getBody: () => responseBody };
}

describe("subscribe handler", () => {
  it("(c) returns 200 even when Supabase insert throws", async () => {
    // Arrange: Supabase is down
    vi.mocked(insertSubmission).mockRejectedValue(
      new Error("Supabase connection refused")
    );
    const { req, res, getStatus, getBody } = mockReqRes();

    // Act
    await handler(req as any, res as any);

    // Assert: Supabase failure must not surface to the user
    expect(getStatus()).toBe(200);
    expect(getBody()).toEqual({ ok: true });
    // Verify the Supabase path was actually attempted (not just a no-op)
    expect(vi.mocked(insertSubmission)).toHaveBeenCalledWith({
      source: "calc",
      email: "candidate@bbc.co.uk",
    });
  });

  it("(d) happy path: valid email returns 200 and logs to Supabase", async () => {
    const { req, res, getStatus, getBody } = mockReqRes("signup@bbc.co.uk");

    await handler(req as any, res as any);

    expect(getStatus()).toBe(200);
    expect(getBody()).toEqual({ ok: true });
    // Supabase was called with the normalised email
    expect(vi.mocked(insertSubmission)).toHaveBeenCalledWith({
      source: "calc",
      email: "signup@bbc.co.uk",
    });
  });

  it("(e) returns 500 when EMAILOCTOPUS_API_KEY is missing", async () => {
    delete process.env.EMAILOCTOPUS_API_KEY;
    const { req, res, getStatus } = mockReqRes();

    await handler(req as any, res as any);

    expect(getStatus()).toBe(500);
    // No EO or Supabase calls should have been made
    expect(vi.mocked(insertSubmission)).not.toHaveBeenCalled();
  });
});
