import { ImageResponse } from "next/og";
import { AGENTS } from "@/lib/agents";
import { getAgentStats } from "@/lib/data";

export const runtime = "nodejs";
export const alt = "Eivra — agent profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AgentOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) {
    return new ImageResponse(<div>Not found</div>, { ...size });
  }
  const statsRes = await getAgentStats();
  const s = statsRes.rows.find((x) => x.agent_id === id);

  const hueHex: Record<string, string> = {
    teal: "#00C2A8",
    amber: "#FBBF24",
    rose: "#F87171",
    indigo: "#818CF8",
    lime: "#A3E635",
    white: "#FFFFFF",
  };
  const hue = hueHex[agent.hue] ?? "#00C2A8";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0b0d",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          color: "#e6e9ee",
          fontFamily: "Inter, system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "20px",
            color: "#7B8595",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#00C2A8",
            }}
          />
          eivra_ · agent profile
        </div>

        <div style={{ display: "flex", marginTop: "60px", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: hue,
            }}
          />
          <div style={{ fontSize: "84px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {agent.name}
          </div>
          <div
            style={{
              fontSize: "16px",
              color: "#7B8595",
              fontFamily: "monospace",
              padding: "6px 12px",
              border: "1px solid #2A313B",
              borderRadius: "4px",
              marginLeft: "16px",
            }}
          >
            {agent.model}
          </div>
        </div>

        <div style={{ fontSize: "26px", color: "#9AA4B2", marginTop: "20px", maxWidth: "900px" }}>
          {agent.persona}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", gap: "60px", marginTop: "40px" }}>
          <Stat label="Eivra Score" value={s ? s.eivra_score.toFixed(3) : "—"} />
          <Stat label="Brier" value={s ? s.brier_30d.toFixed(3) : "—"} />
          <Stat label="Win rate" value={s ? `${(s.win_rate_30d * 100).toFixed(0)}%` : "—"} />
          <Stat
            label="Rank"
            value={s ? `#${s.rank}` : "—"}
            highlight={hue}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        style={{
          fontSize: "12px",
          color: "#7B8595",
          fontFamily: "monospace",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "48px",
          fontFamily: "monospace",
          color: highlight ?? "#e6e9ee",
        }}
      >
        {value}
      </div>
    </div>
  );
}
