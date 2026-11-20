// @vitest-environment happy-dom
// SPEC: docs/design/views/calendar.md — a Saturday-first month grid with free/closed/past markers, keyboard day movement and month changes
// ROADMAP: phase-3-booking / public-calendar / Implement calendar view: month picker, day slots, state labels, disabled taken slots
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import type { AvailabilityDay } from "@/lib/calendar-api";

import { MonthGrid } from "./month-grid";

afterEach(cleanup);

const days: AvailabilityDay[] = [
  {
    day: "2026-11-15",
    closed: false,
    slots: [{ start: "18:30", end: "21:00", state: "free", action: "book" }],
  },
  {
    day: "2026-11-16",
    closed: false,
    slots: [
      { start: "18:30", end: "21:00", state: "confirmed", action: "none" },
    ],
  },
  { day: "2026-11-20", closed: true, slots: [] },
];

function renderGrid(overrides: Partial<Parameters<typeof MonthGrid>[0]> = {}) {
  const onMonth = vi.fn();
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MonthGrid
        month="2026-11"
        days={days}
        today="2026-11-15"
        selected="2026-11-15"
        earliestMonth="2026-11"
        onMonth={onMonth}
        onSelect={onSelect}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
  return { onMonth, onSelect };
}

const dayButton = (text: string) =>
  screen.getByRole("button", { name: new RegExp(`${text},`) });

const labelOf = (text: string) =>
  dayButton(text).getAttribute("aria-label") ?? "";

describe("MonthGrid", () => {
  it("names each day with its date and availability", () => {
    renderGrid();

    expect(labelOf("November 15")).toContain("has free slots");
    expect(labelOf("November 16")).toContain("no free slots");
    expect(labelOf("November 20")).toContain("closed");
    expect(labelOf("November 14")).toContain("a past day");
    expect((dayButton("November 14") as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps one roving tab stop and selects a day on click", () => {
    const { onSelect } = renderGrid();

    expect(dayButton("November 15").tabIndex).toBe(0);
    expect(dayButton("November 16").tabIndex).toBe(-1);

    fireEvent.click(dayButton("November 16"));
    expect(onSelect).toHaveBeenCalledWith("2026-11-16");
  });

  it("moves between days with the arrow keys", () => {
    renderGrid();
    const grid = screen.getByRole("grid");

    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(document.activeElement).toBe(dayButton("November 16"));
    expect(dayButton("November 16").tabIndex).toBe(0);

    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(document.activeElement).toBe(dayButton("November 23"));
  });

  it("changes month with the controls and Page Up/Down", () => {
    const { onMonth } = renderGrid();
    const grid = screen.getByRole("grid");

    expect(
      (
        screen.getByRole("button", {
          name: "Previous month",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    // Page Up cannot leave the earliest month.
    fireEvent.keyDown(grid, { key: "PageUp" });
    expect(onMonth).not.toHaveBeenCalled();

    fireEvent.keyDown(grid, { key: "PageDown" });
    expect(onMonth).toHaveBeenCalledWith("2026-12");

    fireEvent.click(
      screen.getByRole("button", { name: /Next month: December 2026/ }),
    );
    expect(onMonth).toHaveBeenCalledTimes(2);
  });
});
