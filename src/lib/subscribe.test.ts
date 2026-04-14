/**
 * Test (c): Supabase failure does not prevent subscribe returning 200.
 *
 * The subscribe handler uses Promise.allSettled for the Supabase insert,
 * meaning an outage must never surface as a user-facing error. This test
 * verifies that contract by making insertSubmission throw and confirming
 * the handler still returns { ok: true }.
 *
 * Note on mock ordering: vi.mock calls are hoisted by vitest to the top of
 * the module before any imports, so they intercept subscribe.ts's internal
 * imports of _supabase and _email-validator correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted mocks - intercept what subscribe.ts imports internally
vi.mock("../../api/_supabase.js", () => ({
  insertSubmission: vi.fn().mockRejectedValue(new Error("Supabase connection refused")),
}));

vi.mock("../../api/_email-validator.js", () => ({
  validateEmail: vi.fn().mockResolvedValue({ valid: true }),
}));

// Import handler AFTER mock declarations (hoisting makes this safe)
import handler from "../../api/subscribe.js";

beforeEach(() => {
  process.env.EMAILOCTOPUS_API_KEY = "test-api-key";
  process.env.EMAILOCTOPUS_CALC_LIST_ID = "test-list-id";

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
  delete process.env.EMAILOCTOPUS_API_KEY;
  delete process.env.EMAILOCTOPUS_CALC_LIST_ID;
});

describe("subscribe handler", () => {
  it("(c) returns 200 even when Supabase insert throws", async () => {
    let statusCode = 0;
    let responseBody: unknown = null;

    const mockReq = {
      method: "POST",
      body: { email: "candidate@bbc.co.uk" },
    };
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
    };

    await handler(mockReq as any, mockRes as any);

    // Supabase is down, EmailOctopus succeeded => user still gets 200
    expect(statusCode).toBe(200);
    expect(responseBody).toEqual({ ok: true });
  });
});
