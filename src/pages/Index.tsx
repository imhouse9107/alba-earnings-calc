import EarningsCalc from "@/components/EarningsCalc";

const GOLD = "#C09B5C";

const Index = () => {
  return (
    <div className="min-h-screen" style={{ background: "hsl(215, 52%, 11%)", color: "hsl(40, 20%, 96%)" }}>
      {/* Top nav */}
      <nav className="w-full py-5 px-6">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <a href="https://albatalent.io" className="font-display text-[22px]" style={{ color: GOLD }}>
            Alba Talent
          </a>
          <a
            href="https://apply.albatalent.io"
            className="text-[13px] font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >
            Apply for a role →
          </a>
        </div>
      </nav>

      {/* Main */}
      <main className="py-10 md:py-16 px-5">
        <EarningsCalc />
      </main>

      {/* Footer */}
      <footer className="py-10 px-5 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-[720px] mx-auto text-center">
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Alba Talent places UK-based sales reps into US remote roles. Candidates pay nothing, ever. US companies pay us when we place you.
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            <a href="https://albatalent.io" style={{ color: "inherit" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}>albatalent.io</a>
            <a href="https://apply.albatalent.io" style={{ color: "inherit" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}>Apply</a>
            <a href="https://questions.albatalent.io" style={{ color: "inherit" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}>Questions</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
