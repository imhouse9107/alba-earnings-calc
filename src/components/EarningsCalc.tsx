import { useState, useCallback, useMemo, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { compute, fmt, fmtUSD, type CalcInputs, type CalcResults } from "@/lib/calcEngine";

const GOLD = "#C09B5C";
const GOLD_HOVER = "#D4AE6B";

// ---- Types ----

type Phase = "form" | "results";

interface Inputs {
  ukBase: string;
  ukOTE: string;
  usBase: string;
  usOTE: string;
}

const defaultInputs = (): Inputs => ({
  ukBase: "",
  ukOTE: "",
  usBase: "",
  usOTE: "",
});

// ---- Helpers ----

function parseGBP(s: string): number {
  return Math.max(0, parseInt(s.replace(/[^0-9]/g, ""), 10) || 0);
}

function parseUSD(s: string): number {
  return Math.max(0, parseInt(s.replace(/[^0-9]/g, ""), 10) || 0);
}

function isValid(inputs: Inputs): boolean {
  return (
    parseGBP(inputs.ukBase) >= 20000 &&
    parseGBP(inputs.ukOTE) >= 20000 &&
    parseUSD(inputs.usBase) >= 30000 &&
    parseUSD(inputs.usOTE) >= 30000 &&
    parseGBP(inputs.ukOTE) >= parseGBP(inputs.ukBase) &&
    parseUSD(inputs.usOTE) >= parseUSD(inputs.usBase)
  );
}

// ---- Styled primitives ----

const NumberInput = ({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix: string;
  hint?: string;
}) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
        {label}
      </label>
      {hint && (
        <p className="text-[12px] mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{hint}</p>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium select-none" style={{ color: "rgba(255,255,255,0.4)" }}>
          {prefix}
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={12}
          className="w-full rounded-lg pl-8 pr-5 py-4 min-h-[52px] text-white placeholder-white/25 text-[15px] focus:outline-none transition-all"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = GOLD;
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(192,155,92,0.15)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    </div>
  );
};

// ---- Form phase ----

const FormPhase = ({
  inputs,
  onChange,
  onCalculate,
}: {
  inputs: Inputs;
  onChange: (k: keyof Inputs, v: string) => void;
  onCalculate: () => void;
}) => {
  const valid = isValid(inputs);

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="text-center mb-10">
        <p className="eyebrow mb-4" style={{ color: GOLD }}>UK VS US EARNINGS</p>
        <h1 className="font-display text-[40px] md:text-[54px] leading-[1.1] text-white mb-5 tracking-[-0.01em]">
          Your skills are worth more than your postcode allows
        </h1>
        <p className="text-[17px] leading-[1.7] max-w-[520px] mx-auto" style={{ color: "rgba(255,255,255,0.72)" }}>
          Enter your current UK package and a typical US remote role to see the real difference, after tax, in your pocket every month.
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 20px 80px -20px rgba(0,0,0,0.6), 0 0 40px -10px rgba(192,155,92,0.08)",
        }}
      >
        <div className="p-8 md:p-12">
          {/* UK column */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[22px]">🇬🇧</span>
              <p className="font-semibold text-white text-[15px]">Your current UK role</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="Base salary"
                prefix="£"
                value={inputs.ukBase}
                onChange={(v) => onChange("ukBase", v)}
                placeholder="35000"
                hint="Annual, before commission"
              />
              <NumberInput
                label="Total OTE"
                prefix="£"
                value={inputs.ukOTE}
                onChange={(v) => onChange("ukOTE", v)}
                placeholder="55000"
                hint="Base + realistic commission"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[12px] font-medium uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.3)" }}>vs</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* US column */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[22px]">🇺🇸</span>
              <p className="font-semibold text-white text-[15px]">Typical US remote role</p>
            </div>
            <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Not sure? A typical US AE role pays $80K base / $160K OTE. SDR: $55K / $90K.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="US base salary"
                prefix="$"
                value={inputs.usBase}
                onChange={(v) => onChange("usBase", v)}
                placeholder="80000"
                hint="Annual USD base"
              />
              <NumberInput
                label="US total OTE"
                prefix="$"
                value={inputs.usOTE}
                onChange={(v) => onChange("usOTE", v)}
                placeholder="160000"
                hint="Base + on-target commission"
              />
            </div>
          </div>

          <button
            onClick={onCalculate}
            disabled={!valid}
            className="w-full rounded-lg px-8 py-4 min-h-[56px] font-semibold text-[15px] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: valid ? GOLD : "rgba(255,255,255,0.05)",
              color: valid ? "#0D1B2A" : "rgba(255,255,255,0.4)",
              boxShadow: valid ? "0 4px 20px rgba(192,155,92,0.35)" : "none",
            }}
            onMouseEnter={(e) => { if (valid) e.currentTarget.style.backgroundColor = GOLD_HOVER; }}
            onMouseLeave={(e) => { if (valid) e.currentTarget.style.backgroundColor = GOLD; }}
          >
            Show me the difference →
          </button>

          {!valid && (parseGBP(inputs.ukBase) > 0 || parseUSD(inputs.usBase) > 0) && (
            <p className="text-center text-[12px] mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Fill in all four fields. UK minimum £20K, US minimum $30K. OTE must be at least as high as base.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Results phase ----

const ComparisonRow = ({
  label,
  ukVal,
  usVal,
  highlight = false,
}: {
  label: string;
  ukVal: string;
  usVal: string;
  highlight?: boolean;
}) => (
  <div
    className="grid grid-cols-3 gap-4 py-4 items-center"
    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
  >
    <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
    <span
      className={`text-right text-[15px] font-semibold ${highlight ? "" : ""}`}
      style={{ color: highlight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.6)" }}
    >
      {ukVal}
    </span>
    <span
      className="text-right text-[15px] font-semibold"
      style={{ color: highlight ? GOLD : "rgba(255,255,255,0.85)" }}
    >
      {usVal}
    </span>
  </div>
);

const StatCard = ({
  stat,
  label,
  sublabel,
}: {
  stat: string;
  label: string;
  sublabel: string;
}) => (
  <div
    className="rounded-xl p-6 text-center flex flex-col items-center"
    style={{ background: "rgba(192,155,92,0.06)", border: "1px solid rgba(192,155,92,0.18)" }}
  >
    <div className="font-display text-[44px] md:text-[52px] leading-none mb-2" style={{ color: GOLD }}>
      {stat}
    </div>
    <p className="font-semibold text-white text-[14px] mb-1">{label}</p>
    <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>{sublabel}</p>
  </div>
);

const ToolkitCard = ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => (
  <div
    className="rounded-xl p-6"
    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
  >
    <p className="font-semibold text-white text-[15px] mb-2">{title}</p>
    <p className="text-[13px] leading-[1.65]" style={{ color: "rgba(255,255,255,0.65)" }}>{body}</p>
  </div>
);

const Avatar = ({ initials }: { initials: string }) => (
  <div
    className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-[14px] shrink-0"
    style={{ background: "rgba(192,155,92,0.15)", color: GOLD, border: `1px solid rgba(192,155,92,0.3)` }}
  >
    {initials}
  </div>
);

const ResultsPhase = ({
  results,
  onReset,
}: {
  results: CalcResults;
  onReset: () => void;
}) => {
  const {
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
    annualDeltaTakeHome,
    monthlyDeltaTakeHome,
    mortgageDiff,
    pensionDiff,
  } = results;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-[720px] mx-auto space-y-8"
    >
      {/* ---- Main comparison table ---- */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 80px -20px rgba(0,0,0,0.6), 0 0 40px -10px rgba(192,155,92,0.08)",
        }}
      >
        <div className="p-8 md:p-10">
          <p className="eyebrow mb-5" style={{ color: GOLD }}>YOUR FULL COMPARISON</p>

          {/* Column headers */}
          <div className="grid grid-cols-3 gap-4 mb-1">
            <div />
            <div className="text-right">
              <span className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                🇬🇧 UK
              </span>
            </div>
            <div className="text-right">
              <span className="text-[13px] font-medium uppercase tracking-[0.1em]" style={{ color: GOLD }}>
                🇺🇸 US
              </span>
            </div>
          </div>

          <ComparisonRow label="Base salary" ukVal={fmt(ukBase)} usVal={`${fmtUSD(usBase)} (${fmt(usBaseGBP)})`} />
          <ComparisonRow label="Total OTE" ukVal={fmt(ukOTE)} usVal={`${fmtUSD(usOTE)} (${fmt(usOTEGBP)})`} />
          <ComparisonRow label="Base take-home" ukVal={fmt(ukBaseTakeHome)} usVal={fmt(usBaseTakeHome)} />
          <ComparisonRow label="OTE take-home" ukVal={fmt(ukOTETakeHome)} usVal={fmt(usOTETakeHome)} highlight />

          {/* Delta callout */}
          <div
            className="mt-6 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ background: "rgba(192,155,92,0.08)", border: "1px solid rgba(192,155,92,0.2)" }}
          >
            <div>
              <p className="text-[13px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Extra take-home per year</p>
              <p className="font-display text-[36px] leading-none" style={{ color: GOLD }}>
                {annualDeltaTakeHome >= 0 ? "+" : ""}{fmt(annualDeltaTakeHome)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[13px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Per month</p>
              <p className="font-display text-[32px] leading-none text-white">
                {monthlyDeltaTakeHome >= 0 ? "+" : ""}{fmt(monthlyDeltaTakeHome)}
              </p>
            </div>
          </div>

          <p className="text-[11px] mt-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            UK figures based on PAYE income tax + NI (2024/25). US figures treat you as a UK-resident self-employed contractor invoicing a US company (W-8BEN exempt from US withholding). You pay UK income tax + Class 4 NI on the GBP equivalent. Exchange rate: 1 USD = £{(1 / 1.27).toFixed(4)} (approx). Not financial advice.
          </p>
        </div>
      </div>

      {/* ---- Section 1: What This Actually Means ---- */}
      <div className="rounded-2xl p-8 md:p-10" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="eyebrow mb-3" style={{ color: GOLD }}>WHAT THIS ACTUALLY MEANS</p>
        <h2 className="font-display text-[28px] md:text-[34px] text-white mb-3">
          Your Skills Are Worth More Than Your Postcode Allows
        </h2>
        <p className="text-[16px] mb-8" style={{ color: "rgba(255,255,255,0.65)" }}>
          Scottish sales professionals working for US companies earn 2-3x more, for the same skills, the same hours, from the same desk.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            stat="3"
            label="extra holidays a year"
            sublabel="at the equivalent daily rate"
          />
          <StatCard
            stat={fmt(mortgageDiff)}
            label="bigger mortgage approved"
            sublabel="based on 4.5x salary multiplier"
          />
          <StatCard
            stat={fmt(pensionDiff)}
            label="more in your pension"
            sublabel="compounded over 25 years"
          />
        </div>
      </div>

      {/* ---- Section 2: How It Actually Happened ---- */}
      <div className="rounded-2xl p-8 md:p-10" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h2 className="font-display text-[28px] md:text-[34px] text-white mb-8">
          How It Actually Happened
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scott card */}
          <div
            className="rounded-xl p-6"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials="SG" />
              <div>
                <p className="font-semibold text-white text-[14px]">Scott Goodman</p>
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>Head of Talent, Alba Talent</p>
              </div>
            </div>
            <p className="text-[14px] leading-[1.7] mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
              Scott was working in cybersecurity sales in Scotland. Good at his job. Hitting targets. But the ceiling was obvious. The UK market pays what the UK market pays. He and Henry sat next to each other at the same firm. They were constantly trading first and second place across the whole UK sales floor. Then Scott got a remote role at a US tech company with 5,000+ employees and over 75 international sellers. Within his first year, he was the fastest growing rep in company history. He hit 150%+ of quota. He made President's Club. He didn't stop. He's now routinely the #1 seller in the entire company, outperforming every rep internationally. Same skillset. Same work ethic. Just a completely different market that actually rewards it.
            </p>
            <p className="text-[13px] italic" style={{ color: "rgba(255,255,255,0.5)" }}>
              "He didn't become a better seller. He found a market that matched what he already was."
            </p>
          </div>

          {/* Henry card */}
          <div
            className="rounded-xl p-6"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Avatar initials="HW" />
              <div>
                <p className="font-semibold text-white text-[14px]">Henry Williams</p>
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>Co-Founder, Alba Talent</p>
              </div>
            </div>
            <p className="text-[14px] leading-[1.7] mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
              Henry sat right next to Scott at the same Scottish cybersecurity firm. Same office. Same market. Same grind. They pushed each other every day, always finishing one and two. Then Henry started working for a US company remotely, quietly, in the second half of his day, while still at his Scottish job. Within months, the results spoke for themselves. He outperformed every American rep by twofold. He was earning three times what his Scottish role paid. He became a foundational hire, earned equity, and stepped into leadership, working alongside innovative founders building at the cutting edge of tech and AI. He got pulled into the US adventure and never looked back. Meanwhile Scott took the number one spot worldwide.
            </p>
            <p className="text-[13px] italic" style={{ color: "rgba(255,255,255,0.5)" }}>
              "The gap isn't talent. It's geography. And geography is no longer a barrier."
            </p>
          </div>
        </div>
      </div>

      {/* ---- Section 3: Your Toolkit ---- */}
      <div className="rounded-2xl p-8 md:p-10" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="eyebrow mb-3" style={{ color: GOLD }}>YOUR TOOLKIT</p>
        <h2 className="font-display text-[28px] md:text-[34px] text-white mb-3">
          Everything You Need to Make the Move
        </h2>
        <p className="text-[16px] mb-8" style={{ color: "rgba(255,255,255,0.65)" }}>
          We spent two years figuring this out the hard way. You don't have to.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <ToolkitCard
            title="The 90-Day Blueprint"
            body="Six phases. Ninety days. Every step mapped from real transitions, skill audit, positioning, outreach, interviews, negotiation, and the move itself."
          />
          <ToolkitCard
            title="Cold Calling Script Pack"
            body="Five scripts built for B2B calls into the US, line by line with tone notes. Your Scottish accent isn't a weakness. It's your edge."
          />
          <ToolkitCard
            title="Objection Playbook"
            body="Every pushback you'll face, pre-loaded with a response. Built from thousands of real conversations."
          />
          <ToolkitCard
            title="Salary Negotiation Playbook"
            body="The exact framework that turned a $130K offer into $160K. Anchor strategy, exact phrases, and the 48-hour leverage window."
          />
        </div>

        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          All of this arrives in your inbox over the next 5 weeks, one tool at a time, each building on the last.
        </p>
      </div>

      {/* ---- Section 4: Bottom CTAs ---- */}
      <div className="rounded-2xl p-8 md:p-10 text-center" style={{ background: "rgba(192,155,92,0.05)", border: "1px solid rgba(192,155,92,0.15)" }}>
        <h2 className="font-display text-[28px] md:text-[34px] text-white mb-3">
          Ready to close the gap?
        </h2>
        <p className="text-[16px] mb-8" style={{ color: "rgba(255,255,255,0.65)" }}>
          Scott has placed dozens of UK sellers into US roles. If your numbers say you're leaving money on the table, let's talk.
        </p>

        <div className="flex flex-col items-center gap-4">
          <a
            href="https://apply.albatalent.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg px-10 py-4 font-semibold text-[16px] transition-all duration-300 w-full sm:w-auto text-center"
            style={{
              backgroundColor: GOLD,
              color: "#0D1B2A",
              boxShadow: "0 4px 20px rgba(192,155,92,0.35)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLD_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = GOLD; }}
          >
            Apply for a call with Scott →
          </a>

          <a
            href="https://questions.albatalent.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] font-medium transition-colors hover:opacity-100"
            style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline", textUnderlineOffset: "4px" }}
          >
            Learn more about Alba Talent →
          </a>

          <button
            onClick={onReset}
            className="text-[13px] transition-colors"
            style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >
            Calculate again
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ---- Main component ----

const EarningsCalc = () => {
  const [phase, setPhase] = useState<Phase>("form");
  const [inputs, setInputs] = useState<Inputs>(defaultInputs());
  const [results, setResults] = useState<CalcResults | null>(null);

  const handleChange = useCallback((k: keyof Inputs, v: string) => {
    setInputs((prev) => ({ ...prev, [k]: v }));
  }, []);

  const handleCalculate = useCallback(() => {
    const calcInputs: CalcInputs = {
      ukBase: parseGBP(inputs.ukBase),
      ukOTE: parseGBP(inputs.ukOTE),
      usBase: parseUSD(inputs.usBase),
      usOTE: parseUSD(inputs.usOTE),
    };
    const r = compute(calcInputs);
    setResults(r);
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [inputs]);

  const handleReset = useCallback(() => {
    setInputs(defaultInputs());
    setResults(null);
    setPhase("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const validForCalc = useMemo(() => isValid(inputs), [inputs]);

  return (
    <AnimatePresence mode="wait">
      {phase === "form" ? (
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <FormPhase inputs={inputs} onChange={handleChange} onCalculate={handleCalculate} />
          {/* suppress unused warning */}
          {validForCalc && null}
        </motion.div>
      ) : (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {results && <ResultsPhase results={results} onReset={handleReset} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EarningsCalc;
