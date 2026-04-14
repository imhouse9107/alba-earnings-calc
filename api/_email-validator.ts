/**
 * Shared email validation logic - Tier 1 (free, server-side).
 *
 * Runs THREE checks in order:
 *   1. Regex format check
 *   2. Disposable email domain blocklist (~70K domains)
 *   3. MX record lookup (domain must have mail servers that can receive mail)
 *
 * Any single failure returns { valid: false, reason: "..." }. All checks
 * run in well under 3 seconds combined unless DNS is hanging, in which
 * case the MX lookup times out at 3 seconds and returns "unknown-domain".
 *
 * Upgrade path: when we add Kickbox (paid Tier 2), it plugs in AFTER this
 * function returns valid=true. The paid API is for "is the mailbox real"
 * which the free tier can't check without SMTP handshakes.
 */

import { promises as dns } from "node:dns";
import { createRequire } from "node:module";

// The `disposable-email-domains` package ships its main export as a JSON file
// (package.json says "main": "./index.json"), not a JS module. Vercel's Node
// ESM runtime can't do `import foo from "disposable-email-domains"` on a JSON
// main - it crashes with FUNCTION_INVOCATION_FAILED. createRequire lets us do
// a CommonJS-style require from inside an ESM module, which correctly handles
// the JSON-as-main pattern.
const requireCjs = createRequire(import.meta.url);
const disposableDomains: string[] = requireCjs("disposable-email-domains");

// Supplementary blocklist - common disposable services missing from the free
// disposable-email-domains package (which has 121k+ entries but still has
// gaps). Verified against live tests 2026-04-11. Add to this list as gaps
// are discovered; new services launch weekly.
const SUPPLEMENTARY_DISPOSABLE = [
  "tempmail.com",
  "temp-mail.io",
  "temp-mail.ru",
  "tempmailaddress.com",
  "throwaway.email",
  "throwaway.com",
  "trashmail.com",
  "trashmail.net",
  "fakeinbox.com",
  "getnada.com",
  "spam4.me",
  "maildrop.cc",
  "dropmail.me",
  "tmail.com",
  "tmail.io",
  "mohmal.com",
  "sharklasers.com", // guerrillamail variant
  "grr.la",           // guerrillamail variant
];

// Convert once to a Set for O(1) lookups instead of O(n) Array.includes.
const DISPOSABLE_SET = new Set<string>([...disposableDomains, ...SUPPLEMENTARY_DISPOSABLE]);

// RFC 5321-compatible email regex: ASCII-only (matches what EmailOctopus and
// basically every other mail provider actually supports). Unicode/IDN email
// addresses technically exist per RFC 6531 but are rare and most SaaS doesn't
// handle them - better to reject at our level with a clear error than let
// them through to a generic "Subscription failed" downstream.
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// RFC 5321 length limits (these are spec, not arbitrary).
const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;

export interface EmailValidationResult {
  valid: boolean;
  reason?:
    | "format"
    | "disposable"
    | "no-mx-records"
    | "dns-lookup-failed"
    | "dns-timeout"
    | "kickbox-undeliverable";
}

/**
 * Perform a DNS MX record lookup with a hard timeout. Returns true if the
 * domain has at least one MX record (i.e. can receive email), false otherwise.
 * Timeout errors and lookup failures are reported distinctly so the caller
 * can decide whether to fail open or closed.
 */
async function hasMxRecords(
  domain: string,
  timeoutMs = 3000
): Promise<{ ok: boolean; reason?: "no-mx-records" | "dns-lookup-failed" | "dns-timeout" }> {
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs)
  );
  try {
    const result = await Promise.race([dns.resolveMx(domain), timeoutPromise]);
    if (result === "timeout") return { ok: false, reason: "dns-timeout" };
    if (!Array.isArray(result) || result.length === 0) {
      return { ok: false, reason: "no-mx-records" };
    }
    return { ok: true };
  } catch (err) {
    // ENOTFOUND, ENODATA, etc. - domain has no mail servers or doesn't exist
    const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return { ok: false, reason: "no-mx-records" };
    }
    return { ok: false, reason: "dns-lookup-failed" };
  }
}

/**
 * Validate an email address using format + disposable-blocklist + MX lookup.
 * Does NOT verify the mailbox exists (that requires a paid API like Kickbox).
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const normalised = email.trim().toLowerCase();

  // Check 1a: total length (cheap check first)
  if (normalised.length === 0 || normalised.length > MAX_EMAIL_LENGTH) {
    return { valid: false, reason: "format" };
  }

  // Check 1b: format (ASCII-only regex, rejects Unicode local parts)
  if (!EMAIL_REGEX.test(normalised)) {
    return { valid: false, reason: "format" };
  }

  // Extract domain after the @
  const atIndex = normalised.lastIndexOf("@");
  const local = normalised.slice(0, atIndex);
  const domain = normalised.slice(atIndex + 1);

  // Check 1c: individual part lengths per RFC 5321
  if (local.length > MAX_LOCAL_LENGTH || domain.length > MAX_DOMAIN_LENGTH) {
    return { valid: false, reason: "format" };
  }

  // Check 2: disposable blocklist
  if (DISPOSABLE_SET.has(domain)) {
    return { valid: false, reason: "disposable" };
  }

  // Check 3: MX lookup (DNS). Fail-open on timeout/lookup error.
  const mx = await hasMxRecords(domain);
  if (!mx.ok && mx.reason === "no-mx-records") {
    return { valid: false, reason: "no-mx-records" };
  }
  if (!mx.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[email-validator] DNS transient failure for ${domain}, failing open. Reason: ${mx.reason}`);
  }

  // Tier 2: Kickbox SMTP verification. Silent no-op if no API key configured.
  // Activates automatically when KICKBOX_API_KEY env var is added.
  const kickboxResult = await verifyWithKickbox(normalised);
  if (kickboxResult.checked && !kickboxResult.ok) {
    return { valid: false, reason: "kickbox-undeliverable" };
  }

  return { valid: true };
}

async function verifyWithKickbox(email: string): Promise<{ checked: boolean; ok: boolean; reason?: string }> {
  const apiKey = process.env.KICKBOX_API_KEY;
  if (!apiKey) return { checked: false, ok: true };

  try {
    const url = new URL("https://api.kickbox.com/v2/verify");
    url.searchParams.set("email", email);
    url.searchParams.set("apikey", apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[email-validator] Kickbox API returned ${response.status}, failing open`);
      return { checked: true, ok: true };
    }

    const body = (await response.json()) as { result?: string; reason?: string };
    if (body.result === "undeliverable") {
      return { checked: true, ok: false, reason: body.reason };
    }
    return { checked: true, ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[email-validator] Kickbox call failed, failing open:`, err);
    return { checked: true, ok: true };
  }
}
