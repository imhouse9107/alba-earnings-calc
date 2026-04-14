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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body ?? {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Invalid email" });
  }

  // Tier 1 email validation: format + disposable blocklist + MX lookup.
  // Runs in ~50ms for good domains, ~3s worst case for DNS timeouts.
  const validation = await validateEmail(email);
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
    const response = await fetch(`${EO_API}/lists/${listId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        email_address: email.toLowerCase().trim(),
        status: "SUBSCRIBED",
        tags: ["calc-tool"],
      }),
    });

    const body = await response.json() as Record<string, unknown>;

    // 409 = already subscribed, treat as success
    if (response.ok || (body?.error as Record<string, unknown>)?.code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") {
      // Fire Supabase insert before responding. No-ops if SUPABASE_URL isn't
      // configured yet. Promise.allSettled ensures serverless doesn't kill
      // the in-flight insert before the response goes out, but a Supabase
      // failure never breaks the user-facing flow.
      const normalisedEmail = email.toLowerCase().trim();
      await Promise.allSettled([
        insertSubmission({ source: "calc", email: normalisedEmail }),
      ]);
      return res.status(200).json({ ok: true });
    }

    console.error("EmailOctopus error", body);
    return res.status(500).json({ error: "Subscription failed" });
  } catch (err) {
    console.error("Subscribe fetch error", err);
    return res.status(500).json({ error: "Network error" });
  }
}
