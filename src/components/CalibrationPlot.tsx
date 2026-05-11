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
          Wilson 95% intervals
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

        {/* Wilson interval bars */}
        {bins.map((bin, i) => {
          const cx = x((bin.bin_low + bin.bin_high) / 2);
          if (bin.n === 0) return null;
          return (
            <line
              key={`ci-${i}`}
              x1={cx}
              y1={y(bin.ci_low)}
              x2={cx}
              y2={y(bin.ci_high)}
              stroke={bin.n >= 5 ? "var(--accent)" : "var(--text-muted)"}
              strokeWidth={1.5}
              opacity={bin.n >= 5 ? 0.7 : 0.4}
            />
          );
        })}

        {/* Dots */}
        {bins.map((bin, i) => {
          const cx = x((bin.bin_low + bin.bin_high) / 2);
          if (bin.n === 0) return null;
          const r = Math.min(8, 2 + Math.sqrt(bin.n));
          const isSparse = bin.n < 5;
          return (
            <g key={`dot-${i}`}>
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
          <div key={`n-${i}`} className="flex flex-col">
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
        <span>Hollow dots = sparse bin (n &lt; 5)</span>
      </div>
    </figure>
  );
}
