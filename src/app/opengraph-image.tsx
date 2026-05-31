import { ImageResponse } from "next/og";
import { getCounters, getAgentStats } from "@/lib/data";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const alt = "Eivra — public AI forecasting, scored continuously";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MODEL_LABEL: Record<string, string> = {
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-5": "GPT-5",
  synthetic: "Ensemble",
};

const COL = {
  bg: "#0a0b0d",
  text: "#e6e9ee",
  muted: "#7B8595",
  dim: "#3a4250",
  border: "#1f2530",
  accent: "#00C2A8",
  positive: "#22c55e",
  negative: "#f87171",
  rose: "#F87171",
  amber: "#FBBF24",
  indigo: "#818CF8",
  lime: "#A3E635",
  white: "#FFFFFF",
};

const HUE_HEX: Record<string, string> = {
  teal: COL.accent,
  amber: COL.amber,
  rose: COL.rose,
  indigo: COL.indigo,
  lime: COL.lime,
  white: COL.white,
};

export default async function OG() {
  const [counters, statsRes] = await Promise.all([
    getCounters(),
    getAgentStats(),
  ]);

  // Rank by composite eivra_score (already sorted in adapter, but assert)
  const ranked = [...statsRes.rows].sort((a, b) => b.eivra_score - a.eivra_score);
  const best = ranked[0];
  const bestAgent = best ? AGENTS.find((a) => a.id === best.agent_id) : null;
  const bestHue = bestAgent ? HUE_HEX[bestAgent.hue] ?? COL.accent : COL.accent;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: COL.bg,
          display: "flex",
          flexDirection: "column",
          padding: "36px 48px",
          color: COL.text,
          fontFamily: "Inter, system-ui",
        }}
      >
        {/* Header strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "16px",
            borderBottom: `1px solid ${COL.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "16px",
              color: COL.muted,
              fontFamily: "monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: COL.accent,
              }}
            />
            <span style={{ color: COL.text, fontWeight: 600 }}>eivra_</span>
            <span style={{ color: COL.muted }}>·</span>
            <span>AI forecasters, scored on real markets</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: COL.positive,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: `1px solid ${COL.positive}`,
              borderRadius: "2px",
              padding: "3px 8px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: COL.positive,
              }}
            />
            LIVE
          </div>
        </div>

        {/* Centerpiece — Best Agent panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "13px",
              color: COL.muted,
              fontFamily: "monospace",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {`── leader · ${bestAgent?.persona ?? "—"} · ${bestAgent ? (MODEL_LABEL[bestAgent.model] ?? bestAgent.model) : "—"} ──`}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "48px",
            }}
          >
            {/* Brier score — huge, primary metric */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "11px",
                  color: COL.muted,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {`${bestAgent?.name ?? "—"} Brier ↓`}
              </div>
              <div
                style={{
                  fontSize: "120px",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  color: bestHue,
                  fontFamily: "monospace",
                }}
              >
                {best ? (best.brier_30d ?? 0).toFixed(3) : "—"}
              </div>
            </div>

            {/* Log-loss */}
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: COL.muted,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Log-loss
              </div>
              <div
                style={{
                  fontSize: "60px",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  color: COL.text,
                  fontFamily: "monospace",
                }}
              >
                {best ? (best.log_loss_30d ?? 0).toFixed(3) : "—"}
              </div>
            </div>

            {/* Spread: last-place Brier vs best */}
            {ranked.length >= 2 && (() => {
              const last = ranked[ranked.length - 1];
              const lastBrier = last?.brier_30d ?? 0;
              const bestBrier = best?.brier_30d ?? 1;
              const ratio = bestBrier > 0 ? lastBrier / bestBrier : 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", paddingBottom: "12px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: COL.muted,
                      fontFamily: "monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    worst/best gap
                  </div>
                  <div
                    style={{
                      fontSize: "60px",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      color: COL.negative,
                      fontFamily: "monospace",
                    }}
                  >
                    {`${ratio.toFixed(1)}×`}
                  </div>
                </div>
              );
            })()}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "14px",
              color: COL.muted,
              marginTop: "4px",
              maxWidth: "1080px",
              fontFamily: "monospace",
            }}
          >
            {`Lowest Brier across ${best?.total_scored ?? 0} resolved Polymarket + Manifold markets. Lower = better calibration.`}
          </div>
        </div>

        {/* Mini leaderboard table */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "20px",
            border: `1px solid ${COL.border}`,
            borderRadius: "2px",
            fontFamily: "monospace",
            fontSize: "13px",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              padding: "8px 16px",
              borderBottom: `1px solid ${COL.border}`,
              color: COL.muted,
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ display: "flex", width: "40px" }}>#</div>
            <div style={{ display: "flex", width: "200px" }}>Agent</div>
            <div style={{ display: "flex", width: "260px" }}>Persona</div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "90px" }}>Win %</div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "90px" }}>Brier ↓</div>
            <div style={{ display: "flex", justifyContent: "flex-end", flex: 1 }}>Paper P&L</div>
          </div>
          {ranked.slice(0, 6).map((s, i) => {
            const agent = AGENTS.find((a) => a.id === s.agent_id);
            const hue = agent ? HUE_HEX[agent.hue] ?? COL.text : COL.text;
            const pnl = s.paper_pnl_30d ?? 0;
            return (
              <div
                key={s.agent_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderBottom: i < 5 ? `1px solid ${COL.border}` : "none",
                  fontSize: "14px",
                  background: i === 0 ? "rgba(0, 194, 168, 0.06)" : "transparent",
                }}
              >
                <div style={{ width: "40px", color: COL.muted }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ width: "200px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: hue,
                    }}
                  />
                  <span style={{ color: COL.text, fontWeight: 500 }}>
                    {agent?.name ?? s.agent_id}
                  </span>
                </div>
                <div style={{ width: "260px", color: COL.muted, fontSize: "12px" }}>
                  {agent?.persona ?? ""}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", width: "90px", color: COL.text }}>
                  {`${((s.win_rate_30d ?? 0) * 100).toFixed(1)}%`}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", width: "90px", color: COL.text }}>
                  {(s.brier_30d ?? 0).toFixed(3)}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    flex: 1,
                    color: pnl >= 0 ? COL.positive : COL.negative,
                  }}
                >
                  {`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom strip — aggregates + stack badges */}
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "14px",
            borderTop: `1px solid ${COL.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "20px",
              alignItems: "center",
              fontSize: "13px",
              color: COL.muted,
              fontFamily: "monospace",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: COL.text, fontWeight: 600 }}>{counters.resolved}</span>
              <span>resolved</span>
            </div>
            <span>·</span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: COL.accent }} />
              <span style={{ color: COL.accent, fontWeight: 600 }}>{counters.liveInFlight}</span>
              <span style={{ color: COL.accent }}>live in flight</span>
            </div>
            <span>·</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: COL.text, fontWeight: 600 }}>{counters.watching}</span>
              <span>open</span>
            </div>
            <span>·</span>
            <span style={{ color: COL.accent }}>eivra.xyz</span>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {[
              "Polymarket",
              "Manifold",
              "Opus 4.7",
              "Sonnet 4.6",
              "GPT-5",
              "eivra.xyz",
            ].map((b, i) => (
              <div
                key={b}
                style={{
                  fontSize: "10px",
                  color: i === 5 ? COL.accent : COL.muted,
                  border: `1px solid ${i === 5 ? COL.accent : COL.border}`,
                  borderRadius: "2px",
                  padding: "3px 7px",
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                }}
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
