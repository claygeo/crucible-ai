import { Sparkles, Users, Zap, Target, Trophy, type LucideIcon } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { DemoEurekaCard } from "@/lib/demo-data";

type TagConfig = {
  Icon: LucideIcon;
  colorClass: string;
  label: string;
  borderClass: string;
};

const TAG_CONFIG: Record<NonNullable<DemoEurekaCard["tag"]>, TagConfig> = {
  consensus: {
    Icon: Users,
    colorClass: "text-lime-400",
    label: "Consensus",
    borderClass: "border-t-lime-400/40",
  },
  contrarian: {
    Icon: Zap,
    colorClass: "text-rose-400",
    label: "Contrarian",
    borderClass: "border-t-rose-400/40",
  },
  calibration: {
    Icon: Target,
    colorClass: "text-amber-400",
    label: "Calibration",
    borderClass: "border-t-amber-400/40",
  },
  precision: {
    Icon: Trophy,
    colorClass: "text-sky-400",
    label: "Precision",
    borderClass: "border-t-sky-400/40",
  },
};

const DEFAULT_CONFIG: TagConfig = {
  Icon: Sparkles,
  colorClass: "text-accent",
  label: "Eureka",
  borderClass: "border-t-accent/20",
};

export function EurekaCard({ card }: { card: DemoEurekaCard }) {
  const cfg = card.tag ? TAG_CONFIG[card.tag] : DEFAULT_CONFIG;
  const { Icon, colorClass, label, borderClass } = cfg;

  return (
    <article
      className={`panel panel-hover px-5 py-4 flex flex-col gap-3 border-t-2 ${borderClass}`}
    >
      <div className={`flex items-center gap-2 text-xs ${colorClass}`}>
        <Icon size={12} aria-hidden="true" />
        <span className="mono uppercase tracking-wider">{label}</span>
        <span className="text-text-muted ml-auto mono">
          {relativeTime(card.generated_at)}
        </span>
      </div>
      <h3 className="heading text-text-primary text-base leading-snug">
        {card.headline}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed">{card.body}</p>
    </article>
  );
}
