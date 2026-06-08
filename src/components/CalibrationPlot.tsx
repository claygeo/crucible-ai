import { Tooltip } from "@/components/Tooltip";

/**
 * CalibrationPlot — 10-bin reliability diagram with Wilson 95% intervals.
 *
 * Per /autoplan review: must show sample sizes + uncertainty bands.
 * Bins with N<5 render as hollow dots in text-muted; not counted toward
 * over/underconfidence labels.
 */
type Bin = {
  bin_low: number;
  bin_high: number;
  n: number;
  observed_rate: number;
  ci_low: number;
  ci_high: number;
};

export function CalibrationPlot({
  bins,
  totalPredictions,
  totalScored,
  width = 480,
  height = 320,
}: {
  bins: Bin[];
  totalPredictions: number;
  totalScored: number;
  width?: number;
  height?: number;
}) {
  // Weighted mean signed calibration error across bins with n >= 5.
  // Positive = agent predicts higher than reality (overconfident).
  // Negative = agent predicts lower than reality (underconfident).
  const calibrationSummary = (() => {
    const valid = bins.filter((b) => b.n >= 5);
    if (valid.length < 2) return null;
    const totalN = valid.reduce((s, b) => s + b.n, 0);
    const wErr =
      valid.reduce((s, b) => s + ((b.bin_low + b.bin_high) / 2 - b.observed_rate) * b.n, 0) /
      totalN;
    if (wErr > 0.05)
      return { label: "Overconfident", cls: "text-rose-400", tip: "Agent's stated probabilities are systematically higher than actual win rates. Tends to be too confident in YES outcomes." };
    if (wErr < -0.05)
      return { label: "Underconfident", cls: "text-amber-400", tip: "Agent's stated probabilities are systematically lower than actual win rates. Tends to hedge more than the data warrants." };
    return { label: "Well-calibrated", cls: "text-positive", tip: "Agent's stated probabilities closely match observed frequencies. The reliability curve hugs the diagonal." };
  })();

  const padLeft = 44;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 44;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const insufficient = totalScored < 20;

  if (insufficient) {
    return (
      <div
        className="panel border-warn/30 bg-warn/5 px-5 py-4 flex flex-col gap-2"
        style={{ minHeight: height }}
      >
        <div className="mono text-[10px] uppercase tracking-wider text-warn">
          [INSUFFICIENT_DATA]
        </div>
        <div className="text-sm text-text-primary">
          Need 20+ resolved predictions to compute a reliable calibration
          curve. Currently {totalScored} scored.
        </div>
        <div className="text-xs text-text-secondary">
          New agents start with a flat prior. As resolutions accumulate, the
          curve will populate from the inside out.
        </div>
      </div>
    );
  }

  // Map probability (0..1) to x; observed rate (0..1) to y (inverted).
  const x = (p: number) => padLeft + p * innerW;
  const y = (p: number) => padTop + (1 - p) * innerH;

  return (
    <figure className="panel px-5 py-5">
      <figcaption className="flex items-baseline justify-between mb-3">
        <h3 className="heading text-text-primary text-sm">
          Calibration · 10-bin reliability
        </h3>
        <span className="mono text-[10px] uppercase tracking-wider text-text-muted">
          <Tooltip tip="Wilson 95% confidence intervals: error bars showing the range of plausible true frequencies for each probability bin. Wider bars = fewer samples in that bin.">
            Wilson 95% intervals
          </Tooltip>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Calibration reliability plot. X axis: forecasted probability bin. Y axis: observed win rate."
      >
        {/* Grid lines */}
        {Array.from({ length: 11 }, (_, i) => i / 10).map((g) => (
          <g key={g}>
            <line
              x1={x(g)}
              y1={padTop}
              x2={x(g)}
              y2={padTop + innerH}
              stroke="var(--border-subtle)"
              strokeWidth={0.5}
            />
            <line
              x1={padLeft}
              y1={y(g)}
              x2={padLeft + innerW}
              y2={y(g)}
              stroke="var(--border-subtle)"
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Perfect-calibration diagonal */}
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(1)}
          y2={y(1)}
          stroke="var(--border-strong)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {/* Diagonal label — helps readers who haven't seen a reliability diagram before */}
        <text
          x={x(0.72)}
          y={y(0.72) - 7}
          textAnchor="middle"
          fontSize="7"
          fill="var(--text-muted)"
          opacity={0.7}
          transform={`rotate(${Math.atan2(-innerH, innerW) * (180 / Math.PI)}, ${x(0.72)}, ${y(0.72) - 7})`}
        >
          perfect calibration
        </text>

        {/* Per-bin: Wilson CI bar + dot, grouped for accessibility */}
        {bins.map((bin, i) => {
          if (bin.n === 0) return null;
          const cx = x((bin.bin_low + bin.bin_high) / 2);
          const r = Math.min(8, 2 + Math.sqrt(bin.n));
          const isSparse = bin.n < 5;
          const label = `${Math.round(bin.bin_low * 100)}–${Math.round(bin.bin_high * 100)}%: observed ${Math.round(bin.observed_rate * 100)}%, n=${bin.n}, 95% CI ${Math.round(bin.ci_low * 100)}–${Math.round(bin.ci_high * 100)}%`;
          return (
            <g key={`bin-${i}`}>
              <title>{label}</title>
              <line
                x1={cx}
                y1={y(bin.ci_low)}
                x2={cx}
                y2={y(bin.ci_high)}
                stroke={isSparse ? "var(--text-muted)" : "var(--accent)"}
                strokeWidth={1.5}
                opacity={isSparse ? 0.4 : 0.7}
              />
              <circle
                cx={cx}
                cy={y(bin.observed_rate)}
                r={r}
                fill={isSparse ? "transparent" : "var(--accent)"}
                stroke={isSparse ? "var(--text-muted)" : "var(--accent)"}
                strokeWidth={isSparse ? 1.5 : 0}
                opacity={isSparse ? 0.5 : 1}
              />
            </g>
          );
        })}

        {/* X axis labels */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
          <text
            key={`xt-${tick}`}
            x={x(tick)}
            y={padTop + innerH + 18}
            textAnchor="middle"
            className="mono"
            fontSize="10"
            fill="var(--text-muted)"
          >
            {Math.round(tick * 100)}
          </text>
        ))}
        <text
          x={padLeft + innerW / 2}
          y={height - 6}
          textAnchor="middle"
          className="mono"
          fontSize="10"
          fill="var(--text-secondary)"
        >
          Forecasted probability (%)
        </text>

        {/* Y axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <text
            key={`yt-${tick}`}
            x={padLeft - 6}
            y={y(tick) + 3}
            textAnchor="end"
            className="mono"
            fontSize="10"
            fill="var(--text-muted)"
          >
            {Math.round(tick * 100)}
          </text>
        ))}
        <text
          transform={`translate(12 ${padTop + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          className="mono"
          fontSize="10"
          fill="var(--text-secondary)"
        >
          Observed win rate (%)
        </text>
      </svg>

      {/* Per-bin counts strip */}
      <div className="mt-2 grid grid-cols-10 gap-0.5 text-center">
        {bins.map((b, i) => (
          <div
            key={`n-${i}`}
            className="flex flex-col"
            title={`${Math.round(b.bin_low * 100)}–${Math.round(b.bin_high * 100)}%: n=${b.n}`}
            aria-label={`${Math.round(b.bin_low * 100)}–${Math.round(b.bin_high * 100)}% bin: ${b.n} prediction${b.n === 1 ? "" : "s"}`}
          >
            <div
              className={`mono text-[9px] ${
                b.n === 0
                  ? "text-text-muted/40"
                  : b.n < 5
                    ? "text-text-muted"
                    : "text-text-secondary"
              }`}
            >
              n={b.n}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between mono text-[10px] uppercase tracking-wider text-text-muted">
        <span>
          Total predictions: {totalPredictions} · Resolved: {totalScored}
        </span>
        <div className="flex items-center gap-3">
          {calibrationSummary && (
            <Tooltip tip={calibrationSummary.tip}>
              <span className={calibrationSummary.cls}>{calibrationSummary.label}</span>
            </Tooltip>
          )}
          <span>Hollow dots = sparse bin (n &lt; 5)</span>
        </div>
      </div>
    </figure>
  );
}
