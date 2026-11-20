// SPEC: docs/features/public-calendar — the month grid starts on Saturday and opens on today or the first day with a free slot
// ROADMAP: phase-3-booking / public-calendar / Implement calendar view: month picker, day slots, state labels, disabled taken slots
import { describe, expect, it } from "vitest";

import {
  addMonths,
  dayNumber,
  daysInMonth,
  defaultDay,
  firstDayOfMonth,
  firstOpenDay,
  lastDayOfMonth,
  longDayLabel,
  monthCells,
  monthLabel,
  monthOf,
  weekdayHeaders,
} from "./calendar-grid";

describe("month arithmetic", () => {
  it("counts the days of a month, leap years included", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-12")).toBe(31);
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  });

  it("moves whole months across year ends", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
  });

  it("takes the month of a date", () => {
    expect(monthOf("2026-11-15")).toBe("2026-11");
    expect(firstDayOfMonth("2026-11")).toBe("2026-11-01");
    expect(dayNumber("2026-11-05")).toBe(5);
  });
});

describe("monthCells", () => {
  it("lays a month out as six Saturday-first weeks", () => {
    // 1 November 2026 is a Sunday: one empty cell, then the month.
    const cells = monthCells("2026-11");
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-11-01");
    expect(cells[30]).toBe("2026-11-30");
    expect(cells[31]).toBeNull();
  });

  it("starts on Saturday when the first is a Saturday", () => {
    // 1 August 2026 is a Saturday.
    expect(monthCells("2026-08")[0]).toBe("2026-08-01");
  });
});

describe("labels", () => {
  it("names weekdays in grid order", () => {
    expect(weekdayHeaders("en")[0]).toBe("Sat");
    expect(weekdayHeaders("en")[6]).toBe("Fri");
    expect(weekdayHeaders("en")).toHaveLength(7);
  });

  it("writes month and day names in the active language", () => {
    expect(monthLabel("2026-11", "en")).toBe("November 2026");
    expect(monthLabel("2026-11", "ar")).toContain("نوفمبر");
    expect(longDayLabel("2026-11-15", "en")).toContain("15");
    expect(longDayLabel("2026-11-15", "ar")).toContain("نوفمبر");
  });
});

describe("opening selection", () => {
  it("opens on today when it is in the month", () => {
    expect(defaultDay("2026-11", "2026-11-15")).toBe("2026-11-15");
    expect(defaultDay("2026-12", "2026-11-15")).toBe("2026-12-01");
  });

  it("prefers today when it still has a bookable slot", () => {
    expect(
      firstOpenDay(
        [
          { day: "2026-11-14", closed: false, slots: [{ action: "book" }] },
          { day: "2026-11-15", closed: false, slots: [{ action: "call" }] },
          { day: "2026-11-16", closed: false, slots: [{ action: "book" }] },
        ],
        "2026-11-15",
      ),
    ).toBe("2026-11-15");
  });

  it("falls to the first open day, skipping past, closed and full days", () => {
    expect(
      firstOpenDay(
        [
          { day: "2026-11-14", closed: false, slots: [{ action: "book" }] },
          { day: "2026-11-15", closed: false, slots: [{ action: "none" }] },
          { day: "2026-11-16", closed: true, slots: [{ action: "book" }] },
          { day: "2026-11-17", closed: false, slots: [{ action: "none" }] },
          { day: "2026-11-18", closed: false, slots: [{ action: "call" }] },
        ],
        "2026-11-15",
      ),
    ).toBe("2026-11-18");
  });

  it("keeps today when the month has nothing open", () => {
    expect(
      firstOpenDay(
        [{ day: "2026-11-15", closed: false, slots: [{ action: "none" }] }],
        "2026-11-15",
      ),
    ).toBe("2026-11-15");
  });
});
