// US SaaS sales compensation benchmarks
//
// LAST RECALIBRATED: 2026-04-11 against live Repvue + Bravado data pulled that day.
//
// Hard anchor points (NOT guesses - actual verified medians):
//   - SDR (Repvue, Aug 2025):                $60K base / $85K OTE median
//   - SMB AE (Repvue, Mar 2026):             $70K base / $135K OTE median
//   - Mid-Market AE (Repvue, Apr 2026):      $90K base / $180K OTE median
//   - Account Executive general (Repvue):    $100K base / $195K OTE median
//   - Enterprise AE (Repvue, 2025):          $130K base / $260K OTE median
//   - CSM general (Bravado, 2025):           $77K base / $112K total avg
//   - SMB CSM (Bravado, 2025):               $60K base / $103K total avg
//   - Enterprise CSM (Bravado, 2025):        $91K base / $166K total avg
//
// Principle: cells lean to the verified median for that segment, never above.
// If a cell shows a number higher than the source median, it's because
// experience in that band pushes into the next segment (e.g. AE 5-10 yrs is
// usually doing MM/Commercial deals, not SMB).
//
// Alba's placements target mid-market SaaS scale-ups that hire UK remote talent
// - NOT top-decile Silicon Valley comp. These numbers should match LinkedIn
// job posts, not fantasy aspirational comp. Defensibility > flash.

export type Role =
  | "sdr"
  | "ae"
  | "senior-ae"
  | "sales-manager"
  | "csm";

export type Experience = "1-2" | "3-5" | "5-10" | "10+";

export interface RoleOption {
  value: Role;
  label: string;
}

export interface ExperienceOption {
  value: Experience;
  label: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { value: "sdr", label: "SDR / BDR" },
  { value: "ae", label: "Account Executive" },
  { value: "senior-ae", label: "Senior / Enterprise AE" },
  { value: "sales-manager", label: "Sales Manager" },
  { value: "csm", label: "Customer Success Manager" },
];

export const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  { value: "1-2", label: "1-2 years" },
  { value: "3-5", label: "3-5 years" },
  { value: "5-10", label: "5-10 years" },
  { value: "10+", label: "10+ years" },
];

interface BenchmarkCell {
  base: number; // USD
  ote: number;  // USD
}

const BENCHMARKS: Record<Role, Record<Experience, BenchmarkCell | null>> = {
  // SDR Repvue median is $60K / $85K. Seniors (3-5 yrs) push to top of range
  // ($65K / $100K). After 5+ yrs most SDRs have been promoted - cap shown here
  // reflects the career-SDR plateau.
  sdr: {
    "1-2": { base: 55000, ote: 80000 },
    "3-5": { base: 65000, ote: 100000 },
    "5-10": { base: 72000, ote: 115000 },
    "10+": { base: 72000, ote: 115000 },
  },
  // AE curve follows the three Repvue segments:
  //   1-2 yrs  -> SMB AE median ($70K / $135K)
  //   3-5 yrs  -> Mid-Market AE median ($90K / $180K)
  //   5-10 yrs -> General AE median ($100K / $195K), trending into Commercial
  //   10+ yrs  -> Commercial / Pre-Enterprise AE
  ae: {
    "1-2": { base: 70000, ote: 135000 },
    "3-5": { base: 90000, ote: 180000 },
    "5-10": { base: 105000, ote: 205000 },
    "10+": { base: 120000, ote: 235000 },
  },
  // Enterprise AE Repvue median $130K / $260K. Cells climb from that anchor.
  // Top performer ($600K+) intentionally NOT represented - Alba places to
  // median, not top-decile dream roles.
  "senior-ae": {
    "1-2": null, // redirects to AE 1-2
    "3-5": { base: 130000, ote: 260000 },
    "5-10": { base: 150000, ote: 290000 },
    "10+": { base: 170000, ote: 330000 },
  },
  // First-line Sales Manager US median: ~$140K / $245K (Pavilion/Everstage).
  // Senior SM / Director-light hits $170K / $300K.
  "sales-manager": {
    "1-2": null,
    "3-5": { base: 135000, ote: 235000 },
    "5-10": { base: 155000, ote: 275000 },
    "10+": { base: 180000, ote: 320000 },
  },
  // CSM Bravado avg $77K base / $112K total (general). SMB $60K / $103K.
  // Enterprise $91K / $166K. Cells move from SMB up to Enterprise.
  csm: {
    "1-2": { base: 62000, ote: 95000 },
    "3-5": { base: 77000, ote: 115000 },
    "5-10": { base: 92000, ote: 145000 },
    "10+": { base: 110000, ote: 170000 },
  },
};

/**
 * Look up US market benchmark for a given role and experience combination.
 * Falls back to Account Executive at the same experience level if the user
 * picked a senior role with junior experience (which is edge-case garbage
 * input, but better to show a sane number than crash).
 */
export function getBenchmark(role: Role, experience: Experience): BenchmarkCell {
  const cell = BENCHMARKS[role][experience];
  if (cell) return cell;
  // Fallback: use AE at the same experience band
  const fallback = BENCHMARKS.ae[experience];
  if (fallback) return fallback;
  // Absolute fallback - should never hit this
  return { base: 70000, ote: 135000 };
}

export function getRoleLabel(role: Role): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
