// Alba Earnings Calculator - Calc Engine
// All monetary values in GBP unless suffixed USD.

export const GBP_USD_RATE = 1.27;

// UK income tax + NI approximation (2024/25 rates)
// Personal allowance: £12,570. Basic rate: 20% up to £50,270. Higher: 40%.
// NI: 8% on £12,570–£50,270, 2% above.
export function ukTakeHome(gross: number): number {
  const pa = 12570;
  const basicLimit = 50270;
  const higherLimit = 125140;

  let tax = 0;
  if (gross > higherLimit) {
    // PA taper (simplified: PA eliminated above £125,140)
    tax += (gross - higherLimit) * 0.45;
    tax += (higherLimit - basicLimit) * 0.4;
    tax += (basicLimit - pa) * 0.2;
  } else if (gross > basicLimit) {
    tax += (gross - basicLimit) * 0.4;
    tax += (basicLimit - pa) * 0.2;
  } else if (gross > pa) {
    tax += (gross - pa) * 0.2;
  }

  // NI Class 1 employee
  let ni = 0;
  if (gross > basicLimit) {
    ni += (gross - basicLimit) * 0.02;
    ni += (basicLimit - pa) * 0.08;
  } else if (gross > pa) {
    ni += (gross - pa) * 0.08;
  }

  return Math.round(gross - tax - ni);
}

// US contractor self-assessment approximation (UK resident, paid in USD, converted to GBP)
// As a self-employed UK contractor you pay UK income tax + NI Class 4.
// NI Class 4: 9% on £12,570–£50,270, 2% above. Class 2 ~£3.45/wk negligible.
// US withholding: none if UK contractor invoices US co (W8-BEN), pays UK tax.
export function usTakeHome(grossUSD: number): number {
  const grossGBP = grossUSD / GBP_USD_RATE;
  const pa = 12570;
  const basicLimit = 50270;
  const higherLimit = 125140;

  let tax = 0;
  if (grossGBP > higherLimit) {
    tax += (grossGBP - higherLimit) * 0.45;
    tax += (higherLimit - basicLimit) * 0.4;
    tax += (basicLimit - pa) * 0.2;
  } else if (grossGBP > basicLimit) {
    tax += (grossGBP - basicLimit) * 0.4;
    tax += (basicLimit - pa) * 0.2;
  } else if (grossGBP > pa) {
    tax += (grossGBP - pa) * 0.2;
  }

  // NI Class 4 (self-employed)
  let ni = 0;
  if (grossGBP > basicLimit) {
    ni += (grossGBP - basicLimit) * 0.02;
    ni += (basicLimit - pa) * 0.09;
  } else if (grossGBP > pa) {
    ni += (grossGBP - pa) * 0.09;
  }

  return Math.round(grossGBP - tax - ni);
}

export interface CalcInputs {
  ukBase: number;       // GBP annual base
  ukOTE: number;        // GBP annual OTE
  usBase: number;       // USD annual base
  usOTE: number;        // USD annual OTE
}

export interface CalcResults {
  // UK
  ukBase: number;
  ukOTE: number;
  ukBaseTakeHome: number;
  ukOTETakeHome: number;

  // US (in USD)
  usBase: number;
  usOTE: number;

  // US in GBP
  usBaseGBP: number;
  usOTEGBP: number;
  usBaseTakeHome: number;
  usOTETakeHome: number;

  // Deltas (at OTE)
  annualDeltaGross: number;    // usOTEGBP - ukOTE
  annualDeltaTakeHome: number; // usTakeHome - ukTakeHome
  monthlyDeltaTakeHome: number;

  // Section 1 stats
  extraHolidays: number;       // always 3
  mortgageDiff: number;        // (usBaseGBP - ukBase) * 4.5
  pensionDiff: number;         // annualDeltaTakeHome * 47.7 (FV at 5% / 25yr)
}

export function compute(inputs: CalcInputs): CalcResults {
  const { ukBase, ukOTE, usBase, usOTE } = inputs;

  const usBaseGBP = Math.round(usBase / GBP_USD_RATE);
  const usOTEGBP = Math.round(usOTE / GBP_USD_RATE);

  const ukBaseTakeHome = ukTakeHome(ukBase);
  const ukOTETakeHome = ukTakeHome(ukOTE);
  const usBaseTakeHome = usTakeHome(usBase);
  const usOTETakeHome = usTakeHome(usOTE);

  const annualDeltaGross = usOTEGBP - ukOTE;
  const annualDeltaTakeHome = usOTETakeHome - ukOTETakeHome;
  const monthlyDeltaTakeHome = Math.round(annualDeltaTakeHome / 12);

  // Section 1: What This Actually Means
  const extraHolidays = 3;
  const mortgageDiff = Math.round((usBaseGBP - ukBase) * 4.5);
  // Future value annuity: P * ((1.05^25 - 1) / 0.05) * contribution rate
  // Simplified to FV factor 47.7 (5% annual, 25 years) applied to annual delta
  const pensionContribution = annualDeltaTakeHome * 0.05; // 5% of extra take-home
  const pensionDiff = Math.round(pensionContribution * 47.7);

  return {
    ukBase,
    ukOTE,
    ukBaseTakeHome,
    ukOTETakeHome,
    usBase,
    usOTE,
    usBaseGBP,
    usOTEGBP,
    usBaseTakeHome,
    usOTETakeHome,
    annualDeltaGross,
    annualDeltaTakeHome,
    monthlyDeltaTakeHome,
    extraHolidays,
    mortgageDiff,
    pensionDiff,
  };
}

export function fmt(n: number, prefix = "£"): string {
  if (n < 0) return `-${prefix}${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
  return `${prefix}${Math.round(n).toLocaleString("en-GB")}`;
}

export function fmtUSD(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
