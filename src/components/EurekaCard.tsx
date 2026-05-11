import { Sparkles } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { DemoEurekaCard } from "@/lib/demo-data";

export function EurekaCard({ card }: { card: DemoEurekaCard }) {
  return (
    <article className="panel panel-hover px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-accent text-xs">
        <Sparkles size={12} aria-hidden="true" />
        <span className="mono uppercase tracking-wider">Eureka</span>
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
