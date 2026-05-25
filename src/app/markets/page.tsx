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

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "politics", label: "Politics" },
  { key: "sports", label: "Sports" },
  { key: "ai-tech", label: "AI & Tech" },
  { key: "crypto", label: "Crypto" },
  { key: "other", label: "Other" },
] as const;

type CategoryKey = (typeof CATEGORY_TABS)[number]["key"];

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory: CategoryKey =
    (CATEGORY_TABS.find((c) => c.key === category)?.key as CategoryKey) ?? "all";

  const [openRes, resolvedRes] = await Promise.all([
    getMarkets({ status: "open", limit: 200 }),
    getMarkets({ status: "resolved", limit: 200 }),
  ]);
  const allOpen = openRes.rows;
  const allResolved = resolvedRes.rows;

  const filteredOpen =
    activeCategory === "all"
      ? allOpen
      : allOpen.filter((m) => m.category === activeCategory);

  const filteredResolved =
    activeCategory === "all"
      ? allResolved
      : allResolved.filter((m) => m.category === activeCategory);

  const tabs = CATEGORY_TABS.map((c) => ({
    ...c,
    count:
      c.key === "all"
        ? allOpen.length
        : allOpen.filter((m) => m.category === c.key).length,
  })).filter((c) => c.count > 0 || c.key === "all");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-14 flex flex-col gap-10">

        {/* Hero */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 mono text-xs text-text-muted uppercase tracking-wider">
            <span className="live-dot" aria-hidden="true" />
            eivra_ · tracked markets
          </div>
          <h1 className="heading text-3xl text-text-primary tracking-tight">
            {allOpen.length} open markets{" "}
            <span className="text-text-muted font-normal">·</span>{" "}
            <span className="text-text-secondary">{allResolved.length} resolved</span>
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl">
            Every question Eivra&apos;s agents are currently forecasting, plus the
            archive of resolved events with outcome verdicts.
          </p>
        </div>

        {/* Category filter tabs */}
        <nav aria-label="Filter markets by category">
          <div className="flex flex-wrap gap-2">
            {tabs.map((c) => (
              <Link
                key={c.key}
                href={c.key === "all" ? "/markets" : `/markets?category=${c.key}`}
                aria-current={activeCategory === c.key ? "page" : undefined}
                className={`mono text-xs px-3 py-1.5 rounded border transition-colors ${
                  activeCategory === c.key
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-surface-elevated border-border-subtle text-text-muted hover:text-text-primary hover:border-text-muted/30"
                }`}
              >
                {c.label}{" "}
                <span className={activeCategory === c.key ? "opacity-70" : "opacity-50"}>
                  {c.count}
                </span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Open markets */}
        <section className="flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">
            Open ({filteredOpen.length})
          </h2>
          <div className="panel divide-y divide-border-subtle">
            {filteredOpen.length === 0 ? (
              <div className="px-5 py-8 mono text-xs text-text-muted">
                [ ] No{activeCategory !== "all" ? ` ${activeCategory}` : ""} markets open right now.
              </div>
            ) : (
              filteredOpen.map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-4 panel-hover flex items-start gap-4"
                >
                  <div className="shrink-0 flex flex-col items-start gap-1">
                    {activeCategory === "all" && (
                      <span
                        className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryClass(m.category)}`}
                      >
                        {m.category}
                      </span>
                    )}
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
                  {m.url && m.url !== "#" && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 mt-0.5"
                      aria-label="View on source"
                    >
                      <ExternalLink size={12} className="text-text-muted hover:text-accent transition-colors" />
                    </a>
                  )}
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

        {/* Resolved markets */}
        <section className="flex flex-col gap-3">
          <h2 className="heading text-lg text-text-primary">
            Resolved ({filteredResolved.length})
          </h2>
          <div className="panel divide-y divide-border-subtle">
            {filteredResolved.length === 0 ? (
              <div className="px-5 py-8 mono text-xs text-text-muted">
                [ ] No{activeCategory !== "all" ? ` ${activeCategory}` : ""} resolved markets scored yet.
              </div>
            ) : (
              filteredResolved.map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-4 panel-hover flex items-start gap-4"
                >
                  <div className="shrink-0 flex flex-col items-start gap-1">
                    {activeCategory === "all" && (
                      <span
                        className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryClass(m.category)}`}
                      >
                        {m.category}
                      </span>
                    )}
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
