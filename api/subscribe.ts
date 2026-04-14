/**
 * Vercel serverless function: POST /api/subscribe
 *
 * Subscribes an email address to the Alba Talent calc EmailOctopus list.
 * Called fire-and-forget from the Step 2 form; failure is silent on the client.
 *
 * Required env vars (set in Vercel dashboard):
 *   - EMAILOCTOPUS_API_KEY
 *   - EMAILOCTOPUS_CALC_LIST_ID
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateEmail } from "./_email-validator.js";
import { insertSubmission } from "./_supabase.js";

const EO_API = "https://emailoctopus.com/api/1.6";

// Simple in-memory rate limiter (per function instance, resets on cold start).
// Limits each IP to 10 subscribe attempts per minute. Protects against EO
// quota exhaustion and DNS credit burn from unauthenticated callers.
//
// Upgrade path for high traffic: replace with Upstash Redis rate limiter:
//   https://github.com/upstash/ratelimit-js
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const ipCounts = new Map<string, { n: number; t: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now - entry.t > RATE_WINDOW_MS) {
    ipCounts.set(ip, { n: 1, t: now });
    return false;
  }
  if (entry.n >= RATE_MAX) return true;
  entry.n++;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit by IP before any I/O
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    "unknown";
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please try again in a minute." });
  }

  const { email } = req.body ?? {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Invalid email" });
  }

  // Normalise once at entry - used consistently throughout
  const normalisedEmail = email.trim().toLowerCase();

  // Tier 1 email validation: format + disposable blocklist + MX lookup.
  // Runs in ~50ms for good domains, ~3s worst case for DNS timeouts.
  const validation = await validateEmail(normalisedEmail);
  if (!validation.valid) {
    const message =
      validation.reason === "disposable"
        ? "Please use your real work or personal email, not a disposable address."
        : validation.reason === "no-mx-records" || validation.reason === "dns-lookup-failed"
        ? "That email domain doesn't look right. Please double-check and try again."
        : validation.reason === "kickbox-undeliverable"
        ? "That email address looks undeliverable. Please double-check and try again."
        : "Please enter a valid email address.";
    return res.status(400).json({ error: message });
  }

  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_CALC_LIST_ID;

  if (!apiKey || !listId) {
    console.error("Missing EMAILOCTOPUS_API_KEY or EMAILOCTOPUS_CALC_LIST_ID");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // EO subscription and Supabase logging run concurrently - independent I/O.
    // Supabase is fire-and-forget; EO result determines the response.
    const [eoSettled] = await Promise.allSettled([
      fetch(`${EO_API}/lists/${listId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          email_address: normalisedEmail,
          status: "SUBSCRIBED",
          tags: ["calc-tool"],
        }),
      }),
      insertSubmission({ source: "calc", email: normalisedEmail }),
    ]);

    if (eoSettled.status === "rejected") {
      console.error("Subscribe fetch error", eoSettled.reason);
      return res.status(500).json({ error: "Network error" });
    }

    const response = eoSettled.value;
    const body = (await response.json()) as Record<string, unknown>;

    // 409 = already subscribed, treat as success
    if (
      response.ok ||
      (body?.error as Record<string, unknown>)?.code ===
        "MEMBER_EXISTS_WITH_EMAIL_ADDRESS"
    ) {
      return res.status(200).json({ ok: true });
    }

    console.error("EmailOctopus error", body);
    return res.status(500).json({ error: "Subscription failed" });
  } catch (err) {
    console.error("Subscribe error", err);
    return res.status(500).json({ error: "Network error" });
  }
}
