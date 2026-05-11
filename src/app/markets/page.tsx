import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DEMO_MARKETS } from "@/lib/demo-data";
import { relativeTime, pct } from "@/lib/format";

export const metadata = {
  title: "Markets — Crucible",
};

export default function MarketsPage() {
  const open = DEMO_MARKETS.filter((m) => m.status === "open");
  const resolved = DEMO_MARKETS.filter((m) => m.status === "resolved");
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-12">
        <div className="flex flex-col gap-2">
          <h1 className="heading text-3xl text-text-primary tracking-tight">
            Markets
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl">
            Every question the colosseum is currently watching, plus the
            archive of resolved events.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">
            Open ({open.length})
          </h2>
          <div className="panel divide-y divide-border-subtle">
            {open.map((m) => (
              <div
                key={m.id}
                className="px-5 py-4 panel-hover flex items-center gap-4"
              >
                <span
                  className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryClass(m.category)}`}
                >
                  {m.category}
                </span>
                <span className="flex-1 text-text-primary text-sm">
                  {m.question}
                </span>
                <span className="mono text-xs text-text-muted">
                  closes {relativeTime(m.closes_at)}
                </span>
                <span className="mono text-xs text-text-primary">
                  P={pct(m.outcome_yes_price)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">
            Resolved ({resolved.length})
          </h2>
          <div className="panel divide-y divide-border-subtle">
            {resolved.map((m) => (
              <div
                key={m.id}
                className="px-5 py-4 panel-hover flex items-center gap-4"
              >
                <span
                  className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryClass(m.category)}`}
                >
                  {m.category}
                </span>
                <span className="flex-1 text-text-primary text-sm">
                  {m.question}
                </span>
                <span className="mono text-xs text-text-muted">
                  resolved {relativeTime(m.resolved_at!)}
                </span>
                <span
                  className={`mono text-xs px-2 py-0.5 rounded ${
                    m.resolved_outcome
                      ? "bg-positive/10 text-positive"
                      : "bg-rose-400/10 text-rose-400"
                  }`}
                >
                  {m.resolved_outcome ? "YES" : "NO"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function categoryClass(c: string) {
  switch (c) {
    case "politics":
      return "bg-indigo-400/10 text-indigo-300";
    case "crypto":
      return "bg-amber-400/10 text-amber-300";
    case "sports":
      return "bg-positive/10 text-positive";
    case "ai-tech":
      return "bg-accent/10 text-accent";
    default:
      return "bg-text-muted/10 text-text-muted";
  }
}
