-- RLS migration for the submissions table (calc site)
--
-- Run this in the Supabase SQL editor at:
--   https://supabase.com/dashboard/project/wgbrnunxhgtpqkqlakdv/sql
--
-- After running this migration:
-- 1. Get the anon key from: Project Settings > API > Project API keys > anon public
-- 2. Add SUPABASE_ANON_KEY to Vercel env vars (Preview + Production)
-- 3. The service role key (SUPABASE_SERVICE_ROLE_KEY) can then be removed from Vercel
--
-- This grants INSERT-only access to anonymous (public) callers. No SELECT,
-- UPDATE, or DELETE is allowed without an authenticated session. This is the
-- correct least-privilege setup for a public-facing funnel endpoint.

-- Step 1: Enable Row Level Security on the submissions table
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Step 2: Allow anonymous inserts only (the public funnel endpoints)
CREATE POLICY "anon can insert submissions"
  ON submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Step 3: Block all reads/updates/deletes from anon (explicit deny as documentation)
-- RLS denies by default when no matching policy exists, so these are optional
-- but make the intent explicit.
CREATE POLICY "anon cannot select submissions"
  ON submissions
  FOR SELECT
  TO anon
  USING (false);

-- Note: authenticated users (service role, dashboard) retain full access
-- because the service role bypasses RLS entirely.
