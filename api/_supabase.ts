/**
 * Supabase helper - insert submissions into the `submissions` table.
 *
 * Uses the REST API directly (no @supabase/supabase-js dependency) because
 * we only need a single POST per call and the SDK adds ~100KB to the function
 * bundle for no meaningful benefit.
 *
 * Fire-and-forget philosophy: if Supabase is slow or down, we never let it
 * block the user's submission flow. The EmailOctopus write is the primary
 * path; Supabase is the secondary/analytics path. Callers should NOT await
 * this - use `.catch(() => {})` or ignore entirely.
 *
 * Configured via SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars. If
 * unset, silently no-ops (no-op locally, no-op in test environments).
 */

// Matches the schema in _supabase-schema.sql - keep in sync.
export interface SubmissionRow {
  source: "calc" | "scorecard" | "second-chance";
  email: string;

  // Calc fields
  calc_role?: string | null;
  calc_experience?: string | null;
  calc_uk_base?: number | null;
  calc_uk_ote?: number | null;
  calc_us_base?: number | null;
  calc_us_ote?: number | null;
  calc_monthly_delta?: number | null;

  // Scorecard fields
  full_name?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  score?: number | null;
  band?: string | null;
  gate_fail?: boolean | null;
  gate_fail_reason?: string | null;
  experience_score?: number | null;
  intent_score?: number | null;
  commitment_score?: number | null;
  current_ote_gbp?: string | null;       // raw user input
  current_ote_gbp_int?: number | null;   // parsed integer - the FILTER column
  q1_intent?: string | null;
  q2_role?: string | null;
  q3_years?: string | null;
  q11_cold_outbound?: string | null;
  q12_industries?: string[] | null;
  q13_commission_only?: string | null;
  q14_revenue_bucket?: string | null;
  answers_json?: Record<string, unknown> | null;

  // Second chance
  second_chance_text?: string | null;
  second_chance_score?: number | null;
  second_chance_verdict?: string | null;
  second_chance_reason?: string | null;

  // Metadata
  user_agent?: string | null;
  ip_country?: string | null;
  referrer?: string | null;
}

/**
 * Insert a submission row. Returns true on success, false on any failure.
 * Never throws - swallows all errors after logging. Caller decides whether
 * to wait for the promise (generally: don't).
 */
export async function insertSubmission(row: SubmissionRow): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Silent no-op in environments without Supabase configured
    return false;
  }

  try {
    const endpoint = `${url.replace(/\/$/, "")}/rest/v1/submissions`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        // Return=minimal means we don't get the inserted row back. Faster,
        // lower bandwidth, and we don't need the row ID for anything.
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.warn("[supabase] insert failed", { status: res.status, body });
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[supabase] insert threw", err);
    return false;
  }
}
