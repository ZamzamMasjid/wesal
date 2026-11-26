// SPEC: customer-mobile-app/spec.md — the calendar and booking page show Cairo
// dates, localised times and EGP amounts.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Implement calendar, booking
// form, booking page and proof upload screens

import {
  addDays,
  addMonths,
  cairoToday,
  countdown,
  dayLabel,
  dayNumber,
  defaultDay,
  firstDayOfMonth,
  firstOpenDay,
  formatTime,
  lastDayOfMonth,
  longDayLabel,
  money,
  monthCells,
  monthLabel,
  monthOf,
  weekdayHeaders,
} from "./dates";

describe("cairoToday", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses the venue's Cairo day, not the device's UTC day", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-25T22:30:00Z"));

    // 22:30 UTC is already 00:30 on the 26th in Cairo (UTC+2).
    expect(cairoToday()).toBe("2026-11-26");
  });

  it("returns a YYYY-MM-DD string during the Cairo day", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-02T09:00:00Z"));

    expect(cairoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cairoToday()).toBe("2026-01-02");
  });
});

describe("day and month arithmetic", () => {
  it("adds days across a month and a year boundary", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("takes the month from a day", () => {
    expect(monthOf("2026-11-25")).toBe("2026-11");
  });

  it("finds the first and last day of a month", () => {
    expect(firstDayOfMonth("2026-11")).toBe("2026-11-01");
    expect(lastDayOfMonth("2026-11")).toBe("2026-11-30");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29");
  });

  it("moves between months across a year boundary", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-06", 6)).toBe("2026-12");
  });
});

describe("month grid", () => {
  it("lays a month out in six Saturday-first weeks", () => {
    const cells = monthCells("2026-11");
    expect(cells).toHaveLength(42);
    // 1 November 2026 is a Sunday, so the first cell is empty.
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-11-01");
    expect(cells[30]).toBe("2026-11-30");
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(dayNumber("2026-11-25")).toBe(25);
  });

  it("names the weekdays from Saturday", () => {
    expect(weekdayHeaders("en")).toEqual([
      "Sat",
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ]);
    expect(weekdayHeaders("ar")[0]).toBe("السبت");
  });

  it("opens on today or the first open day", () => {
    expect(defaultDay("2026-11", "2026-11-25")).toBe("2026-11-25");
    expect(defaultDay("2026-12", "2026-11-25")).toBe("2026-12-01");

    const days = [
      { day: "2026-11-25", closed: true, slots: [{ action: "book" }] },
      { day: "2026-11-26", closed: false, slots: [{ action: "none" }] },
      { day: "2026-11-27", closed: false, slots: [{ action: "book" }] },
    ];
    expect(firstOpenDay(days, "2026-11-25")).toBe("2026-11-27");
    expect(firstOpenDay([], "2026-11-25")).toBe("2026-11-25");
  });
});

describe("localised labels", () => {
  it("labels a month in English and Arabic", () => {
    expect(monthLabel("2026-11", "en")).toBe("November 2026");
    expect(monthLabel("2026-11", "ar")).toMatch(/نوفمبر/);
    // Western digits in the grid heading, like the website's calendar.
    expect(monthLabel("2026-11", "ar")).toMatch(/2026/);
  });

  it("labels the selected day for the day panel", () => {
    expect(longDayLabel("2026-11-25", "en")).toBe("Wednesday 25 November");
    expect(longDayLabel("2026-11-25", "ar")).toMatch(/الأربعاء/);
  });

  it("labels a day in English and Arabic", () => {
    expect(dayLabel("2026-11-25", "en")).toBe("Wednesday 25 Nov");
    expect(dayLabel("2026-11-25", "ar")).toMatch(/الأربعاء/);
    expect(dayLabel("2026-11-25", "ar")).toMatch(/٢٥/);
  });

  it("formats a slot time in 12-hour English and Arabic", () => {
    expect(formatTime("09:05", "en")).toBe("9:05 am");
    expect(formatTime("13:30", "en")).toBe("1:30 pm");
    expect(formatTime("13:30", "ar")).toMatch(/١:٣٠/);
    expect(formatTime("13:30", "ar")).toMatch(/م/);
  });

  it("formats EGP with no decimals and Latin digits in Arabic", () => {
    expect(money("en", 1500)).toContain("1,500");
    expect(money("en", 1500)).toContain("EGP");
    expect(money("ar", 1500)).toContain("1,500");
    expect(money("ar", 1500)).toContain("ج.م");
  });
});

describe("countdown", () => {
  it("shows mm:ss under an hour", () => {
    expect(countdown(0)).toBe("00:00");
    expect(countdown(59)).toBe("00:59");
    expect(countdown(60)).toBe("01:00");
    expect(countdown(3599)).toBe("59:59");
  });

  it("shows h:mm:ss from one hour up", () => {
    expect(countdown(3600)).toBe("1:00:00");
    expect(countdown(3661)).toBe("1:01:01");
  });

  it("never goes negative and floors fractions", () => {
    expect(countdown(-10)).toBe("00:00");
    expect(countdown(90.9)).toBe("01:30");
  });
});
