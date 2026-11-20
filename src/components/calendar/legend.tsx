"use client";

import { useTranslations } from "next-intl";

import type { SlotState } from "@/lib/calendar-api";

import { StateBadge } from "./state-badge";

// The five states in one row under the two cards; each is a label plus an icon,
// so the legend never relies on color alone (docs/design/system.md).

const STATES: SlotState[] = [
  "free",
  "awaiting_payment",
  "awaiting_review",
  "confirmed",
  "closed",
];

export function Legend() {
  const t = useTranslations("Calendar");

  return (
    <section aria-labelledby="calendar-legend-heading">
      <h2
        id="calendar-legend-heading"
        className="text-sm font-medium text-muted"
      >
        {t("legendTitle")}
      </h2>
      <ul className="mt-2 flex flex-wrap items-center gap-2">
        {STATES.map((state) => (
          <li key={state}>
            <StateBadge state={state} variant="legend" />
          </li>
        ))}
      </ul>
    </section>
  );
}
