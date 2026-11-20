import {
  CheckCircle2,
  Circle,
  Eye,
  Hourglass,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { SlotState } from "@/lib/calendar-api";

// The five slot states, always a label plus an icon, never color alone
// (docs/design/system.md). The colors are fixed per state.

const STYLES: Record<SlotState, { className: string; Icon: LucideIcon }> = {
  free: { className: "bg-surface text-accent", Icon: Circle },
  awaiting_payment: {
    className: "bg-warning-soft text-warning",
    Icon: Hourglass,
  },
  awaiting_review: { className: "bg-brand-soft text-brand", Icon: Eye },
  confirmed: { className: "bg-fill text-muted", Icon: CheckCircle2 },
  closed: { className: "bg-fill text-muted line-through", Icon: Lock },
};

export interface StateBadgeProps {
  state: SlotState;
  /** The legend tints a free badge so it reads as a sample, not a live slot. */
  variant?: "slot" | "legend";
  /** A state that just changed on refresh animates its badge once. */
  changed?: boolean;
  className?: string;
}

export function StateBadge({
  state,
  variant = "slot",
  changed = false,
  className = "",
}: StateBadgeProps) {
  const t = useTranslations("Calendar.states");
  const { className: style, Icon } = STYLES[state];
  const freeInLegend =
    variant === "legend" && state === "free" ? "bg-accent-soft" : "";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${
        changed ? "animate-[badge-pop_0.35s_ease-out]" : ""
      } ${freeInLegend || style} ${className}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      {t(state)}
    </span>
  );
}
