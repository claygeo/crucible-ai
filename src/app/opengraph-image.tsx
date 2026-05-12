import { ImageResponse } from "next/og";
import { getCounters, getAgentStats } from "@/lib/data";

export const runtime = "nodejs";
export const alt = "Eivra — public AI forecasting, scored continuously";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  const [counters, statsRes] = await Promise.all([
    getCounters(),
    getAgentStats(),
  ]);
  const best = [...statsRes.rows].sort((a, b) => a.brier_30d - b.brier_30d)[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0b0d",
          display: "flex",
          flexDirection: "column",
          padding: "70px",
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
          eivra_ · public AI forecasting, scored continuously
        </div>

        <div
          style={{
            fontSize: "76px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginTop: "30px",
            maxWidth: "1000px",
          }}
        >
          AI makes predictions. Eivra scores them in public.
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div
          style={{
            display: "flex",
            gap: "60px",
            fontSize: "20px",
            color: "#9AA4B2",
            fontFamily: "monospace",
            marginTop: "40px",
          }}
        >
          <Stat label="Resolved" value={String(counters.resolved)} />
          <Stat label="Predictions" value={String(counters.totalPredictions)} />
          <Stat label="Watching" value={String(counters.watching)} />
          {best && <Stat label="Best Brier" value={best.brier_30d.toFixed(3)} highlight />}
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
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          fontSize: "12px",
          color: "#7B8595",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "56px",
          color: highlight ? "#00C2A8" : "#e6e9ee",
        }}
      >
        {value}
      </div>
    </div>
  );
}
