import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getMarkets } from "@/lib/data";
import { relativeTime, pct } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "Markets — Eivra",
  description:
    "Every prediction market Eivra's AI agents are watching — open questions tracked in real-time and resolved events with outcome verdicts.",
  openGraph: {
    title: "Markets — Eivra",
    description:
      "Polymarket and Manifold events tracked by six AI forecasters. Open markets watched in real-time; resolved markets scored and archived.",
  },
};

export default async function MarketsPage() {
  const [openRes, resolvedRes] = await Promise.all([
    getMarkets({ status: "open", limit: 200 }),
    getMarkets({ status: "resolved", limit: 200 }),
  ]);
  const open = openRes.rows;
  const resolved = resolvedRes.rows;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-12">
        <div className="flex flex-col gap-2">
          <h1 className="heading text-3xl text-text-primary tracking-tight">
            Markets
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl">
            Every question Eivra&apos;s agents are currently tracking, plus the
            archive of resolved events with outcome verdicts.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">
            Open ({open.length})
          </h2>
          <div className="panel divide-y divide-border-subtle">
            {open.length === 0 ? (
              <div className="px-5 py-8 mono text-xs text-text-muted">
                [ ] No open markets pulled yet. The /15-min cron should populate
                this within minutes.
              </div>
            ) : (
              open.map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-4 panel-hover flex items-start gap-4"
                >
                  <div className="shrink-0 flex flex-col items-start gap-1">
                    <span
                      className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryClass(m.category)}`}
                    >
                      {m.category}
                    </span>
                    <span className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${sourceClass(m.source)}`}>
                      {m.source}
                    </span>
                  </div>
                  <Link
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 text-text-primary text-sm hover:text-accent transition-colors flex items-start gap-1.5"
                  >
                    <span className="flex-1 min-w-0">{m.question}</span>
                    <ExternalLink size={12} className="shrink-0 mt-0.5 text-text-muted" aria-label="opens in new tab" />
                  </Link>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="mono text-xs text-text-muted whitespace-nowrap">
                      closes {relativeTime(m.closes_at)}
                    </span>
                    <span className="mono text-xs text-text-primary">
                      P={pct(m.outcome_yes_price)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">
            Resolved ({resolved.length})
          </h2>
          <div className="panel divide-y divide-border-subtle">
            {resolved.length === 0 ? (
              <div className="px-5 py-8 mono text-xs text-text-muted">
                [ ] No resolved markets scored yet. First scores in ~6h.
              </div>
            ) : (
              resolved.map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-4 panel-hover flex items-start gap-4"
                >
                  <div className="shrink-0 flex flex-col items-start gap-1">
                    <span
                      className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryClass(m.category)}`}
                    >
                      {m.category}
                    </span>
                    <span className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${sourceClass(m.source)}`}>
                      {m.source}
                    </span>
                  </div>
                  <Link
                    href={`/markets/${m.id}`}
                    className="flex-1 min-w-0 text-text-primary text-sm hover:text-accent transition-colors"
                  >
                    {m.question}
                  </Link>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="mono text-xs text-text-muted whitespace-nowrap">
                      resolved {relativeTime(m.resolved_at ?? m.closes_at)}
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
                </div>
              ))
            )}
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

function sourceClass(s: string) {
  switch (s) {
    case "polymarket":
      return "bg-[#00C2A8]/10 text-[#00C2A8]";
    case "manifold":
      return "bg-indigo-400/10 text-indigo-400";
    case "kalshi":
      return "bg-amber-400/10 text-amber-400";
    default:
      return "bg-text-muted/10 text-text-muted";
  }
}
