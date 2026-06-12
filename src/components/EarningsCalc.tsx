import { useState, useCallback, useMemo, useId, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MuxPlayer from "@mux/mux-player-react";
import { compute, fmt, fmtUSD, type CalcInputs, type CalcResults } from "@/lib/calcEngine";
import { ROLE_OPTIONS, EXPERIENCE_OPTIONS, getRoleLabel, type Role, type Experience } from "@/lib/benchmarks";

const MUX_ENV_KEY = import.meta.env.VITE_MUX_ENV_KEY as string | undefined;

const GOLD = "#C09B5C";
const GOLD_HOVER = "#D4AE6B";

// ---- Types ----

type Phase = "form" | "email-gate" | "results";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Inputs {
  role: Role | "";
  experience: Experience | "";
  ukBase: string;
  ukOTE: string;
}

const defaultInputs = (): Inputs => ({
  role: "",
  experience: "",
  ukBase: "",
  ukOTE: "",
});

// ---- Helpers ----

function parseGBP(s: string): number {
  return Math.max(0, parseInt(s.replace(/[^0-9]/g, ""), 10) || 0);
}

function isValid(inputs: Inputs): boolean {
  return (
    inputs.role !== "" &&
    inputs.experience !== "" &&
    parseGBP(inputs.ukBase) >= 18000 &&
    parseGBP(inputs.ukOTE) >= 18000 &&
    parseGBP(inputs.ukOTE) >= parseGBP(inputs.ukBase)
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
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix: string;
  hint?: string;
  error?: string;
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
            border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.1)"}`,
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = GOLD;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(192,155,92,0.15)`;
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "#f87171" : "rgba(255,255,255,0.1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
      {error && (
        <p className="text-[12px] mt-1.5" style={{ color: "#f87171" }}>{error}</p>
      )}
    </div>
  );
};

// ---- Select card picker (for role + experience) ----

const SelectCard = <T extends string>({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-lg px-4 py-3 text-[14px] font-medium text-left transition-all duration-200"
    style={{
      color: selected ? "#FFFFFF" : "rgba(255,255,255,0.75)",
      backgroundColor: selected ? "rgba(192,155,92,0.14)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${selected ? GOLD : "rgba(255,255,255,0.1)"}`,
      boxShadow: selected ? "0 0 0 3px rgba(192,155,92,0.12)" : "none",
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);

// ---- Form phase ----

const FormPhase = ({
  inputs,
  onChange,
  onCalculate,
}: {
  inputs: Inputs;
  onChange: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  onCalculate: () => void;
}) => {
  const valid = isValid(inputs);

  const ukBase = parseGBP(inputs.ukBase);
  const ukOTE = parseGBP(inputs.ukOTE);
  const oteError =
    ukOTE > 0 && ukBase > 0 && ukOTE < ukBase
      ? "OTE must be at least as high as your base (it includes base + commission)"
      : undefined;

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="text-center mb-10">
        <p className="eyebrow mb-4" style={{ color: GOLD }}>UK VS US EARNINGS</p>
        <h1 className="font-display text-[40px] md:text-[54px] leading-[1.1] text-white mb-5 tracking-[-0.01em]">
          Your skills are worth more than your postcode allows
        </h1>
        <p className="text-[17px] leading-[1.7] max-w-[520px] mx-auto" style={{ color: "rgba(255,255,255,0.72)" }}>
          Tell us what you do and what you earn. We'll show you what the same seat pays in the US, after tax, in your pocket every month.
        </p>
      </div>

      {/*
        Trust video - Scott explaining why Alba needs these numbers and what
        happens with them. Hosted on Mux Video (playback ID below). Mux Player
        handles adaptive bitrate streaming + analytics. Plays BEFORE the income
        inputs so candidates see a real person before handing over salary data.
      */}
      <div className="mb-8 max-w-[640px] mx-auto">
        <div className="text-center mb-4">
          <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
            Before you share your numbers — a note from Scott
          </p>
        </div>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            aspectRatio: "16 / 9",
            border: "1px solid rgba(192, 155, 92, 0.25)",
            boxShadow:
              "0 20px 60px -15px rgba(0,0,0,0.7), 0 0 50px -12px rgba(192,155,92,0.12)",
            backgroundColor: "#000",
          }}
        >
          <MuxPlayer
            playbackId="zD6IYLZnTwyHFp26Jy02MVGQwlUnwzpTML9qxUrmmlys"
            streamType="on-demand"
            preload="metadata"
            metadata={{
              video_id: "calc-trust-scott",
              video_title: "Scott Goodman, Before you share your numbers",
              player_name: "calc-trust",
            }}
            envKey={MUX_ENV_KEY}
            accentColor="#C09B5C"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          />
        </div>
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
          {/* Role picker */}
          <div className="mb-8">
            <p className="font-semibold text-white text-[15px] mb-4">What do you do?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLE_OPTIONS.map((r) => (
                <SelectCard
                  key={r.value}
                  label={r.label}
                  selected={inputs.role === r.value}
                  onClick={() => onChange("role", r.value)}
                />
              ))}
            </div>
          </div>

          {/* Experience picker */}
          <div className="mb-8">
            <p className="font-semibold text-white text-[15px] mb-4">How long have you been doing it?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {EXPERIENCE_OPTIONS.map((e) => (
                <SelectCard
                  key={e.value}
                  label={e.label}
                  selected={inputs.experience === e.value}
                  onClick={() => onChange("experience", e.value)}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[12px] font-medium uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.3)" }}>your uk package</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* UK inputs */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[22px]">🇬🇧</span>
              <p className="font-semibold text-white text-[15px]">What you earn right now</p>
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
                error={oteError}
              />
            </div>
          </div>

          <button
            onClick={onCalculate}
            disabled={!valid}
            className="w-full rounded-lg px-8 py-4 min-h-[56px] font-semibold text-[15px] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: valid ? GOLD : "rgba(255,255,255,0.05)",
              color: valid ? "#0D1B2A" : "rgba(255,255,255,0.4)",
              boxShadow: valid ? "0 4px 20px rgba(192,155,92,0.35)" : "none",
            }}
            onMouseEnter={(e) => { if (valid) e.currentTarget.style.backgroundColor = GOLD_HOVER; }}
            onMouseLeave={(e) => { if (valid) e.currentTarget.style.backgroundColor = GOLD; }}
          >
            Reveal what you're worth in the US →
          </button>

          {!valid && (inputs.role !== "" || ukBase > 0) && (
            <p className="text-center text-[13px] mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>
              {inputs.role === ""
                ? "Select your role above to continue."
                : inputs.experience === ""
                ? "Select your experience level to continue."
                : ukBase < 18000 || ukOTE < 18000
                ? "Enter your base and OTE (minimum £18K each)."
                : oteError
                ? "Your OTE should be higher than your base salary."
                : "Fill in all fields to reveal your US earnings."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Email gate phase ----
//
// Sits between form submission and results. The calc has already run (results
// are pre-computed in parent state) - this step captures the email to trigger
// the EmailOctopus nurture sequence, then flips to results on success.
// Silent-fail if subscribe throws: we still show results rather than hold them
// hostage to a network error.

const EmailGatePhase = ({
  preview,
  onSubmit,
  isSubmitting,
}: {
  preview: { roleLabel: string; experienceLabel: string };
  onSubmit: (email: string) => void;
  isSubmitting: boolean;
}) => {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const emailId = useId();
  const valid = EMAIL_REGEX.test(email.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isSubmitting) return;
    onSubmit(email.trim().toLowerCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-[560px] mx-auto"
    >
      <div className="text-center mb-8">
        <p className="eyebrow mb-4" style={{ color: GOLD }}>ONE STEP AWAY</p>
        <h1 className="font-display text-[36px] md:text-[46px] leading-[1.1] text-white mb-5 tracking-[-0.01em]">
          Your US earnings are ready.
        </h1>
        <p className="text-[16px] leading-[1.65] max-w-[480px] mx-auto" style={{ color: "rgba(255,255,255,0.72)" }}>
          We've looked up what a {preview.roleLabel.toLowerCase()} with {preview.experienceLabel} makes in the US, ran the tax math both sides, and compared it to what you're earning now.
        </p>
      </div>

      <div
        className="rounded-2xl p-8 md:p-10"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 20px 80px -20px rgba(0,0,0,0.6), 0 0 40px -10px rgba(192,155,92,0.08)",
        }}
      >
        {/* Value prop - what they get for their email */}
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: GOLD }}>
          Unlock your free toolkit
        </p>
        <p className="text-[14px] mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
          Enter your email to get your earnings breakdown plus our complete US sales transition toolkit:
        </p>
        <ul className="space-y-2.5 mb-6">
          {[
            { title: "The 90-Day Blueprint", desc: "Every step mapped from 47 real transitions. Six phases. No guesswork." },
            { title: "US Interview Prep Pack", desc: "The exact questions US hiring managers ask UK candidates, with model answers." },
            { title: "Objection Handling Playbook", desc: "Built from a $450M VP's desk. Every pushback you'll face, pre-loaded with a response." },
            { title: "Salary Negotiation Framework", desc: "The framework that turned a $130K offer into $160K. Exact phrases included." },
          ].map(({ title, desc }) => (
            <li key={title} className="flex items-start gap-2.5 text-[13px]">
              <span className="shrink-0 mt-0.5" style={{ color: GOLD }}>{"✓"}</span>
              <span style={{ color: "rgba(255,255,255,0.8)" }}>
                <span className="font-semibold text-white">{title}</span>{" "}{desc}
              </span>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit}>
          <label htmlFor={emailId} className="block text-[14px] font-medium mb-3 text-white">
            Where should we send your breakdown and toolkit?
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="you@company.com"
            required
            className="w-full rounded-lg px-5 py-4 min-h-[56px] text-white placeholder-white/25 text-[15px] focus:outline-none transition-all"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = GOLD;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(192,155,92,0.15)`;
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {email.length > 0 && !valid && (
            <p className="text-[12px] mt-2" style={{ color: "#f87171" }}>
              Please enter a valid email address.
            </p>
          )}

          {email.length === 0 && touched && (
            <p className="text-[12px] mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              Enter your email to unlock your results and free toolkit.
            </p>
          )}

          <button
            type="submit"
            disabled={!valid || isSubmitting}
            onClick={() => setTouched(true)}
            className="mt-5 w-full rounded-lg px-8 py-4 min-h-[56px] font-semibold text-[15px] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: valid && !isSubmitting ? GOLD : "rgba(255,255,255,0.05)",
              color: valid && !isSubmitting ? "#0D1B2A" : "rgba(255,255,255,0.4)",
              boxShadow: valid && !isSubmitting ? "0 4px 20px rgba(192,155,92,0.35)" : "none",
            }}
            onMouseEnter={(e) => { if (valid && !isSubmitting) e.currentTarget.style.backgroundColor = GOLD_HOVER; }}
            onMouseLeave={(e) => { if (valid && !isSubmitting) e.currentTarget.style.backgroundColor = GOLD; }}
          >
            {isSubmitting ? "Unlocking..." : "Reveal my US earnings →"}
          </button>

          <p className="text-[12px] mt-5 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
            We spent two years building these resources from real transitions. No spam, unsubscribe anytime.
          </p>
        </form>
      </div>
    </motion.div>
  );
};

// ---- Celebration effects ----

/** Animated counter that rolls up from 0 to the target value */
const AnimatedNumber = ({ value, prefix = "", duration = 1.2, delay = 0 }: {
  value: number; prefix?: string; duration?: number; delay?: number;
}) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = (now - start) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setDisplay(Math.round(value * eased));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [value, duration, delay]);

  return <span ref={ref}>{prefix}{fmt(display)}</span>;
};

/** Gold sparkle particles that burst outward from the delta callout */
const CelebrationBurst = () => {
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360;
    const distance = 60 + Math.random() * 80;
    const size = 3 + Math.random() * 4;
    const x = Math.cos((angle * Math.PI) / 180) * distance;
    const y = Math.sin((angle * Math.PI) / 180) * distance;
    const delay = Math.random() * 0.3;
    return { x, y, size, delay, angle };
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: `hsl(${40 + Math.random() * 20}, ${70 + Math.random() * 30}%, ${60 + Math.random() * 25}%)`,
            left: "50%",
            top: "50%",
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.8 + Math.random() * 0.4, delay: 0.6 + p.delay, ease: "easeOut" }}
        />
      ))}
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
  email,
}: {
  results: CalcResults;
  onReset: () => void;
  email: string;
}) => {
  const [stickyVisible, setStickyVisible] = useState(false);
  const deltaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = deltaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStickyVisible(true); },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // Query-string handoff to scorecard. We include role + experience + uk_base +
  // uk_ote so the scorecard can pre-fill the "current" step and skip it entirely
  // (we don't want to rub it in by asking for earnings twice). The scorecard
  // parses these on mount - see PlacementScorecard.tsx:parseCalcParams.
  const applyUrl =
    `https://apply.albatalent.io` +
    `?monthly_delta=${monthlyDeltaTakeHome}` +
    `&role=${encodeURIComponent(results.role)}` +
    `&exp=${encodeURIComponent(results.experience)}` +
    `&uk_base=${ukBase}` +
    `&uk_ote=${ukOTE}` +
    `&us_ote=${usOTE}` +
    (email ? `&email=${encodeURIComponent(email)}` : "");

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
          <p className="eyebrow mb-3" style={{ color: GOLD }}>THE REVEAL</p>
          <h2 className="font-display text-[26px] md:text-[32px] leading-[1.15] text-white mb-2 tracking-[-0.01em]">
            A {getRoleLabel(results.role).toLowerCase()} with {results.experience} years pays this in the US
          </h2>
          <p className="text-[14px] mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
            Based on 2024/25 US SaaS market medians. Same seat. Same hours. Different continent.
          </p>

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

          {/* Delta callout with celebration */}
          <motion.div
            ref={deltaRef}
            className="relative mt-6 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ background: "rgba(192,155,92,0.08)", border: "1px solid rgba(192,155,92,0.2)" }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          >
            <CelebrationBurst />
            <div>
              <p className="text-[13px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Extra take-home per year</p>
              <p className="font-display text-[36px] leading-none" style={{ color: GOLD }}>
                <AnimatedNumber value={annualDeltaTakeHome} prefix={annualDeltaTakeHome >= 0 ? "+" : ""} delay={0.6} />
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[13px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Per month</p>
              <p className="font-display text-[32px] leading-none text-white">
                <AnimatedNumber value={monthlyDeltaTakeHome} prefix={monthlyDeltaTakeHome >= 0 ? "+" : ""} delay={0.8} />
              </p>
            </div>
          </motion.div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            href={applyUrl}
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

      {/* Sticky Apply bar - appears once delta callout scrolls into view */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          transform: stickyVisible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          background: "rgba(13,27,42,0.92)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(192,155,92,0.25)",
          padding: "12px 20px",
        }}
      >
        <div className="max-w-[720px] mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Extra take-home at OTE</p>
            <p className="font-display text-[22px] leading-none" style={{ color: GOLD }}>
              {monthlyDeltaTakeHome >= 0 ? "+" : ""}{fmt(monthlyDeltaTakeHome)}/mo
            </p>
          </div>
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg px-6 py-3 font-semibold text-[14px] transition-all duration-200"
            style={{
              backgroundColor: GOLD,
              color: "#0D1B2A",
              boxShadow: "0 4px 16px rgba(192,155,92,0.4)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLD_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = GOLD; }}
          >
            Apply now →
          </a>
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
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState("");

  const handleChange = useCallback(<K extends keyof Inputs>(k: K, v: Inputs[K]) => {
    setInputs((prev) => ({ ...prev, [k]: v }));
  }, []);

  // Step 1: user submits the form. We compute results immediately (cheap, client-side)
  // and store them in state, but DON'T show them yet - we flip to the email gate
  // phase first. This way the reveal feels instant after email capture.
  const handleCalculate = useCallback(() => {
    if (inputs.role === "" || inputs.experience === "") return;
    const calcInputs: CalcInputs = {
      role: inputs.role,
      experience: inputs.experience,
      ukBase: parseGBP(inputs.ukBase),
      ukOTE: parseGBP(inputs.ukOTE),
    };
    const r = compute(calcInputs);
    setResults(r);
    setPhase("email-gate");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [inputs]);

  // Step 2: user submits their email. POST to /api/subscribe (EmailOctopus)
  // then advance to the results phase regardless of API success. A network
  // failure should NOT block the reveal - we'd rather lose the email than
  // show a broken funnel experience to the user.
  const handleEmailSubmit = useCallback(async (email: string) => {
    setIsSubscribing(true);
    setCapturedEmail(email);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      // Silent failure - the user still sees results, we just didn't capture.
      console.error("[calc] subscribe failed", err);
    } finally {
      setIsSubscribing(false);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleReset = useCallback(() => {
    setInputs(defaultInputs());
    setResults(null);
    setPhase("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const validForCalc = useMemo(() => isValid(inputs), [inputs]);

  const selectedRoleLabel =
    inputs.role !== "" ? ROLE_OPTIONS.find((r) => r.value === inputs.role)?.label ?? "" : "";
  const selectedExperienceLabel =
    inputs.experience !== ""
      ? EXPERIENCE_OPTIONS.find((e) => e.value === inputs.experience)?.label ?? ""
      : "";

  return (
    <AnimatePresence mode="wait">
      {phase === "form" && (
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
      )}

      {phase === "email-gate" && results && (
        <motion.div
          key="email-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmailGatePhase
            preview={{ roleLabel: selectedRoleLabel, experienceLabel: selectedExperienceLabel }}
            onSubmit={handleEmailSubmit}
            isSubmitting={isSubscribing}
          />
        </motion.div>
      )}

      {phase === "results" && results && (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ResultsPhase results={results} onReset={handleReset} email={capturedEmail} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EarningsCalc;
