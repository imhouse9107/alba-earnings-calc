/**
 * Tests for api/_email-validator.ts - failure modes (a) and (b).
 *
 * (a) DNS timeout must fail OPEN (valid: true). The #1 silent lead-loss risk.
 *     A DNS blip must never silently reject a real candidate.
 * (b) bbc.co.uk must pass the disposable blocklist.
 *     Confirms real UK domains aren't caught by the 121K-entry blocklist.
 *
 * Note on mocking strategy: _email-validator.ts imports dns via
 * `import { promises as dns } from "node:dns"`. ESM module namespaces are
 * not configurable, so vi.spyOn won't work. We mock the whole "node:dns"
 * module with vi.mock and override resolveMx as a vi.fn().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as dnsPromises } from "node:dns";
import { validateEmail } from "../../api/_email-validator.js";

// Hoist: mock node:dns so resolveMx is a vi.fn() we can configure per test.
// importOriginal preserves everything else (the rest of the dns API).
vi.mock("node:dns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns")>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      resolveMx: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.mocked(dnsPromises.resolveMx).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("validateEmail", () => {
  it("(a) fails open when DNS MX lookup times out", async () => {
    // Arrange: resolveMx hangs forever (simulates unresponsive DNS server)
    vi.mocked(dnsPromises.resolveMx).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    vi.useFakeTimers();

    // Act: start validation, advance clock past the 3-second DNS timeout
    const promise = validateEmail("test@legitimate-domain.com");
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;

    // Assert: DNS timeout must NOT reject the lead - fail open
    expect(result.valid).toBe(true);
  });

  it("(b) accepts email from a known-good UK domain (bbc.co.uk)", async () => {
    // Arrange: DNS returns a valid MX record
    vi.mocked(dnsPromises.resolveMx).mockResolvedValue([
      { exchange: "cluster5.us.messagelabs.com", priority: 10 },
    ]);

    // Act
    const result = await validateEmail("recruitment@bbc.co.uk");

    // Assert: bbc.co.uk is not disposable, has valid format, MX found => valid
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
