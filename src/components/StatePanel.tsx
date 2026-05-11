/**
 * StatePanel — generic empty / loading / error / degraded state wrapper.
 *
 * Per DESIGN.md state matrix: every screen ships with explicit states.
 * No "TODO: empty state" allowed.
 */
type Variant = "empty" | "loading" | "error" | "degraded" | "info";

const VARIANT_PREFIX: Record<Variant, string> = {
  empty: "[ ]",
  loading: "[…]",
  error: "[ERR]",
  degraded: "[!]",
  info: "[i]",
};

const VARIANT_BORDER: Record<Variant, string> = {
  empty: "border-border-subtle",
  loading: "border-border-subtle",
  error: "border-rose-400/40",
  degraded: "border-warn/40",
  info: "border-accent/40",
};

export function StatePanel({
  variant = "empty",
  title,
  detail,
  action,
  className = "",
}: {
  variant?: Variant;
  title: string;
  detail?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`panel ${VARIANT_BORDER[variant]} flex flex-col items-start gap-2 px-5 py-4 ${className}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "loading" ? "polite" : undefined}
    >
      <div className="mono text-xs uppercase text-text-muted tracking-wider">
        {VARIANT_PREFIX[variant]} {variant.toUpperCase()}
      </div>
      <div className="text-sm text-text-primary">{title}</div>
      {detail && <div className="text-xs text-text-secondary">{detail}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
