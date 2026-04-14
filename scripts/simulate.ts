// Runs realistic UK candidate profiles through the actual calc engine and
// prints what they'd see on the live site. Lets us sanity check benchmarks
// against real-world scenarios rather than trusting the matrix in isolation.
//
// Run: npx tsx scripts/simulate.ts

import { compute, fmt, fmtUSD, GBP_USD_RATE } from "../src/lib/calcEngine.js";
import { getRoleLabel, type Role, type Experience } from "../src/lib/benchmarks.js";

interface Profile {
  name: string;            // descriptive label, e.g. "Scottish SDR, 2 years, £30K"
  role: Role;
  experience: Experience;
  ukBase: number;          // GBP
  ukOTE: number;           // GBP
}

// Profiles calibrated to real UK sales comp (Reed, Glassdoor, Payscale UK, 2024/25)
const PROFILES: Profile[] = [
  // --- SDR profiles ---
  {
    name: "Junior Scottish SDR, 1 year, £28K/£35K",
    role: "sdr",
    experience: "1-2",
    ukBase: 28000,
    ukOTE: 35000,
  },
  {
    name: "Mid Scottish SDR, 3 years, £32K/£42K",
    role: "sdr",
    experience: "3-5",
    ukBase: 32000,
    ukOTE: 42000,
  },

  // --- AE profiles ---
  {
    name: "New London AE, 2 years, £40K/£60K",
    role: "ae",
    experience: "1-2",
    ukBase: 40000,
    ukOTE: 60000,
  },
  {
    name: "Mid Scottish AE, 4 years, £45K/£65K (classic Alba avatar)",
    role: "ae",
    experience: "3-5",
    ukBase: 45000,
    ukOTE: 65000,
  },
  {
    name: "Senior UK AE, 7 years, £60K/£90K",
    role: "ae",
    experience: "5-10",
    ukBase: 60000,
    ukOTE: 90000,
  },
  {
    name: "Seasoned AE, 12 years, £70K/£110K",
    role: "ae",
    experience: "10+",
    ukBase: 70000,
    ukOTE: 110000,
  },

  // --- Enterprise AE profiles ---
  {
    name: "UK Ent AE, 5 years, £65K/£110K",
    role: "senior-ae",
    experience: "3-5",
    ukBase: 65000,
    ukOTE: 110000,
  },
  {
    name: "UK Ent AE, 8 years, £85K/£150K",
    role: "senior-ae",
    experience: "5-10",
    ukBase: 85000,
    ukOTE: 150000,
  },
  {
    name: "Strategic UK Ent AE, 12 years, £110K/£190K",
    role: "senior-ae",
    experience: "10+",
    ukBase: 110000,
    ukOTE: 190000,
  },

  // --- Sales Manager profiles ---
  {
    name: "UK first-line SM, 5 years, £65K/£95K",
    role: "sales-manager",
    experience: "3-5",
    ukBase: 65000,
    ukOTE: 95000,
  },
  {
    name: "UK Sales Director, 10 years, £90K/£140K",
    role: "sales-manager",
    experience: "5-10",
    ukBase: 90000,
    ukOTE: 140000,
  },

  // --- CSM profiles ---
  {
    name: "UK junior CSM, 2 years, £32K/£40K",
    role: "csm",
    experience: "1-2",
    ukBase: 32000,
    ukOTE: 40000,
  },
  {
    name: "UK senior CSM, 6 years, £50K/£65K",
    role: "csm",
    experience: "5-10",
    ukBase: 50000,
    ukOTE: 65000,
  },
];

const DIVIDER = "=".repeat(92);
const THIN = "-".repeat(92);

console.log(DIVIDER);
console.log(`ALBA EARNINGS CALC - BENCHMARK SIMULATIONS (GBP/USD rate: ${GBP_USD_RATE})`);
console.log(DIVIDER);
console.log("");

for (const p of PROFILES) {
  const r = compute({
    role: p.role,
    experience: p.experience,
    ukBase: p.ukBase,
    ukOTE: p.ukOTE,
  });

  // Plausibility checks - these fail loud if the output looks wrong
  const checks: string[] = [];
  if (r.usOTEGBP <= r.ukOTE) {
    checks.push("FAIL: US OTE (GBP) not higher than UK OTE");
  }
  if (r.annualDeltaTakeHome <= 0) {
    checks.push("FAIL: annual take-home delta is negative");
  }
  const multiplier = r.usOTEGBP / r.ukOTE;
  if (multiplier > 4) {
    checks.push(`WARN: US OTE is ${multiplier.toFixed(1)}x UK OTE (probably too aggressive)`);
  }
  if (multiplier < 1.3) {
    checks.push(`WARN: US OTE is only ${multiplier.toFixed(1)}x UK OTE (delta too weak to pitch)`);
  }

  console.log(`PROFILE: ${p.name}`);
  console.log(`  Role/exp:        ${getRoleLabel(p.role)} / ${p.experience} yrs`);
  console.log(`  UK package:      ${fmt(p.ukBase)} base / ${fmt(p.ukOTE)} OTE`);
  console.log(`  US benchmark:    ${fmtUSD(r.usBase)} base / ${fmtUSD(r.usOTE)} OTE`);
  console.log(`                   = ${fmt(r.usBaseGBP)} / ${fmt(r.usOTEGBP)} in GBP`);
  console.log(`  Multiplier:      ${multiplier.toFixed(2)}x at OTE (gross)`);
  console.log(`  UK take-home:    ${fmt(r.ukOTETakeHome)}/yr`);
  console.log(`  US take-home:    ${fmt(r.usOTETakeHome)}/yr`);
  console.log(`  Δ annual:        ${fmt(r.annualDeltaTakeHome)}/yr`);
  console.log(`  Δ monthly:       ${fmt(r.monthlyDeltaTakeHome)}/mo  <-- headline`);
  console.log(`  Mortgage boost:  ${fmt(r.mortgageDiff)}`);
  console.log(`  Pension (25yr):  ${fmt(r.pensionDiff)}`);
  if (checks.length > 0) {
    console.log("  >>> PLAUSIBILITY FLAGS:");
    for (const c of checks) console.log(`      ${c}`);
  } else {
    console.log("  >>> plausibility: OK");
  }
  console.log(THIN);
}

console.log("");
console.log(DIVIDER);
console.log("Done. Review each headline monthly delta - would a UK rep in that role find this");
console.log("believable? Too aggressive = feels like a scam. Too weak = no reason to apply.");
console.log(DIVIDER);
