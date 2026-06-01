import { ImageResponse } from "next/og";
import { AGENTS } from "@/lib/agents";
import { getAgentStats } from "@/lib/data";

export const runtime = "nodejs";
export const alt = "Eivra — agent profile";
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
  border: "#1f2530",
  accent: "#00C2A8",
  positive: "#22c55e",
  negative: "#f87171",
};

const HUE_HEX: Record<string, string> = {
  teal: COL.accent,
  amber: "#FBBF24",
  rose: "#F87171",
  indigo: "#818CF8",
  lime: "#A3E635",
  white: "#FFFFFF",
};

export default async function AgentOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) {
    return new ImageResponse(<div>Not found</div>, { ...size });
  }
  const statsRes = await getAgentStats();
  const s = statsRes.rows.find((x) => x.agent_id === id);
  const echo = statsRes.rows.find((x) => x.agent_id === "echo");

  const hue = HUE_HEX[agent.hue] ?? COL.accent;

  // delta vs market baseline (Echo mirrors market price — it's the bar to beat)
  const brierDelta = s && echo ? s.brier_30d - echo.brier_30d : null;
  const beatsMarket = brierDelta !== null && brierDelta < 0;
  const isBaseline = agent.id === "echo";

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
              fontSize: "15px",
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
            <span>agent profile</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                fontSize: "12px",
                color: COL.muted,
                border: `1px solid ${COL.border}`,
                borderRadius: "2px",
                padding: "3px 10px",
                fontFamily: "monospace",
                letterSpacing: "0.04em",
              }}
            >
              {MODEL_LABEL[agent.model] ?? agent.model}
            </div>
            {s && (
              <div
                style={{
                  fontSize: "12px",
                  color: hue,
                  border: `1px solid ${hue}`,
                  borderRadius: "2px",
                  padding: "3px 10px",
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                }}
              >
                {`RANK #${s.rank}`}
              </div>
            )}
          </div>
        </div>

        {/* Agent name + persona */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: hue,
              }}
            />
            <div
              style={{
                fontSize: "80px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {agent.name}
            </div>
          </div>
          <div
            style={{
              fontSize: "22px",
              color: COL.muted,
              fontFamily: "monospace",
              marginLeft: "42px",
            }}
          >
            {agent.persona}
          </div>
        </div>

        {/* Performance hero row */}
        <div
          style={{
            display: "flex",
            gap: "52px",
            marginTop: "20px",
            alignItems: "flex-end",
          }}
        >
          {/* Brier — primary metric */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "11px",
                color: COL.muted,
                fontFamily: "monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Brier (30d) ↓
            </div>
            <div
              style={{
                fontSize: "100px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: hue,
                fontFamily: "monospace",
              }}
            >
              {s ? s.brier_30d.toFixed(3) : "—"}
            </div>
          </div>

          {/* vs market baseline verdict */}
          {s && !isBaseline && brierDelta !== null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                paddingBottom: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: COL.muted,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                vs market-prior
              </div>
              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: beatsMarket ? COL.positive : COL.negative,
                  fontFamily: "monospace",
                }}
              >
                {`${brierDelta >= 0 ? "+" : ""}${brierDelta.toFixed(3)}`}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: beatsMarket ? COL.positive : COL.negative,
                  fontFamily: "monospace",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {beatsMarket ? "✓ Beats market-prior" : "✗ Trails market-prior"}
              </div>
            </div>
          )}

          {/* Echo: "sets the bar" label instead of delta */}
          {isBaseline && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                paddingBottom: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: COL.muted,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                baseline
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 600,
                  color: COL.accent,
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginTop: "4px",
                }}
              >
                This IS the bar to beat
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: COL.muted,
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                }}
              >
                mirrors market price · small Bayesian steps
              </div>
            </div>
          )}

          <div style={{ display: "flex", flex: 1 }} />

          {/* Win rate */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              paddingBottom: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: COL.muted,
                fontFamily: "monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Win rate
            </div>
            <div
              style={{
                fontSize: "52px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: COL.text,
                fontFamily: "monospace",
              }}
            >
              {s ? `${(s.win_rate_30d * 100).toFixed(1)}%` : "—"}
            </div>
          </div>

          {/* Log-loss */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              paddingBottom: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: COL.muted,
                fontFamily: "monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Log-loss ↓
            </div>
            <div
              style={{
                fontSize: "52px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: COL.text,
                fontFamily: "monospace",
              }}
            >
              {s ? s.log_loss_30d.toFixed(3) : "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        {/* Bottom strip */}
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
              <span style={{ color: COL.text, fontWeight: 600 }}>
                {s?.total_scored ?? 0}
              </span>
              <span>markets scored</span>
            </div>
            <span>·</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <span style={{ color: COL.text, fontWeight: 600 }}>
                {s?.total_predictions ?? 0}
              </span>
              <span>total forecasts</span>
            </div>
            <span>·</span>
            <span style={{ color: COL.accent }}>eivra.xyz</span>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {[MODEL_LABEL[agent.model] ?? agent.model, "Polymarket", "Manifold", "eivra.xyz"].map(
              (b, i) => (
                <div
                  key={b}
                  style={{
                    fontSize: "11px",
                    color: i === 0 ? hue : i === 3 ? COL.accent : COL.muted,
                    border: `1px solid ${i === 0 ? hue : i === 3 ? COL.accent : COL.border}`,
                    borderRadius: "2px",
                    padding: "3px 8px",
                    fontFamily: "monospace",
                    letterSpacing: "0.04em",
                  }}
                >
                  {b}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
