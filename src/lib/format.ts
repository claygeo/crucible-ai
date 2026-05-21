/** Number formatters — keep mono / aligned. */

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function prob(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function num(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function int(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function signed(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}`;
}

export function dollars(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(digits)}`;
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const future = diffMs < 0;
  const sec = Math.floor(Math.abs(diffMs) / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (future) {
    if (sec < 60) return `in ${sec}s`;
    if (min < 60) return `in ${min}m`;
    if (hr < 24) return `in ${hr}h`;
    if (day < 30) return `in ${day}d`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Truncate to N chars with ellipsis. */
export function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

/**
 * Clean agent reasoning text for display.
 *
 * Echo and Sage sometimes echo their full forecast as a JSON object (e.g.
 * ```json {"forecast": 0.13, "rationale": "..."}```) instead of plain prose.
 * The runner extracts probability fine but stores the raw blob as the
 * reasoning field. Without cleanup the UI renders the JSON inline — ugly
 * and unreadable.
 *
 * Heuristic: if the text looks like wrapped JSON, parse it and return the
 * first text-y field we recognize (rationale / reasoning / summary / etc).
 * Otherwise return the original. Always strips code fences.
 */
export function cleanReasoning(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` code fences.
  s = s.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/```\s*$/, "").trim();
  // If it still looks like a JSON object, try parsing.
  if (s.startsWith("{")) {
    // Try the largest balanced { ... } substring.
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const candidate = s.slice(first, last + 1);
      try {
        const obj = JSON.parse(candidate) as Record<string, unknown>;
        // Look for a prose field, in priority order.
        const keys = [
          "rationale",
          "reasoning",
          "summary",
          "explanation",
          "analysis",
          "uncertainty",
          "adjustments",
        ];
        for (const k of keys) {
          const v = obj[k];
          if (typeof v === "string" && v.trim().length > 8) {
            return v.trim();
          }
        }
        // If JSON had no prose field, fall through to the raw text (minus
        // fences) so we at least show something readable.
      } catch {
        // Not actually JSON despite the leading brace — fall through.
      }
    }
  }
  return s;
}
