// SPEC: customer-mobile-app/spec.md — the calendar mirrors the website's month
// grid, marks which days have free slots, and lets the customer move between
// months and open a day's slots.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Implement calendar, booking
// form, booking page and proof upload screens

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { Availability, Slot } from "../api";
import * as api from "../api";
import { text } from "../i18n";
import { CalendarScreen } from "./CalendarScreen";

jest.mock("../api", () => ({
  fetchAvailability: jest.fn(),
}));

jest.mock("../dates", () => {
  const actual = jest.requireActual("../dates");
  return { ...actual, cairoToday: () => "2026-11-25" };
});

const freeSlot: Slot = {
  start: "10:00",
  end: "12:00",
  state: "free",
  action: "book",
  alert: false,
};

const busySlot: Slot = {
  start: "12:00",
  end: "14:00",
  state: "awaiting_payment",
  action: "none",
  alert: false,
};

const availability: Availability = {
  from: "2026-11-01",
  to: "2026-11-30",
  today: "2026-11-25",
  refreshedAt: "2026-11-25T08:00:00Z",
  days: [
    { day: "2026-11-25", closed: false, slots: [freeSlot, busySlot] },
    {
      day: "2026-11-26",
      closed: true,
      slots: [{ ...freeSlot, start: "09:00", end: "10:00" }],
    },
    { day: "2026-11-27", closed: false, slots: [] },
  ],
};

function renderCalendar({
  onBook = jest.fn(),
  onHome = jest.fn(),
}: { onBook?: jest.Mock; onHome?: jest.Mock } = {}) {
  return render(
    <CalendarScreen
      locale="en"
      t={text("en")}
      onBook={onBook}
      onHome={onHome}
    />,
  );
}

beforeEach(() => {
  jest
    .mocked(api.fetchAvailability)
    .mockImplementation(async (from: string, to: string) => ({
      ok: true,
      data:
        from === "2026-11-01"
          ? availability
          : { ...availability, from, to, days: [] },
    }));
});

describe("CalendarScreen", () => {
  it("loads the visible month as a Saturday-first grid", async () => {
    renderCalendar();

    expect(screen.getByText(text("en").sending)).toBeOnTheScreen();
    expect(await screen.findByText("November 2026")).toBeOnTheScreen();
    expect(screen.getByText("Sat")).toBeOnTheScreen();
    expect(screen.getByText("Fri")).toBeOnTheScreen();
    expect(api.fetchAvailability).toHaveBeenCalledWith(
      "2026-11-01",
      "2026-11-30",
    );
  });

  it("opens on today and marks free slots as bookable", async () => {
    const onBook = jest.fn();
    renderCalendar({ onBook });

    expect(await screen.findByText("Wednesday 25 November")).toBeOnTheScreen();
    expect(screen.getByText("Book")).toBeOnTheScreen();
    expect(screen.getByText("Awaiting payment")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Book"));

    expect(onBook).toHaveBeenCalledWith("2026-11-25", freeSlot);
  });

  it("shows a closed day when it is picked in the grid", async () => {
    renderCalendar();
    await screen.findByText("November 2026");

    fireEvent.press(screen.getByTestId("day-2026-11-26"));

    expect(screen.getByText("Thursday 26 November")).toBeOnTheScreen();
    expect(screen.getByText(text("en").noSlots)).toBeOnTheScreen();
  });

  it("moves to the next and previous month", async () => {
    renderCalendar();
    await screen.findByText("November 2026");

    fireEvent.press(screen.getByRole("button", { name: text("en").nextMonth }));

    await waitFor(() => {
      expect(api.fetchAvailability).toHaveBeenLastCalledWith(
        "2026-12-01",
        "2026-12-31",
      );
    });
    expect(screen.getByText("December 2026")).toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole("button", { name: text("en").previousMonth }),
    );

    await waitFor(() => {
      expect(api.fetchAvailability).toHaveBeenLastCalledWith(
        "2026-11-01",
        "2026-11-30",
      );
    });
  });

  it("returns to the home screen from the back link", async () => {
    const onHome = jest.fn();
    renderCalendar({ onHome });
    await screen.findByText("November 2026");

    fireEvent.press(screen.getByRole("button", { name: text("en").backHome }));

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("shows the offline banner when the month cannot be loaded", async () => {
    jest.mocked(api.fetchAvailability).mockResolvedValue({
      ok: false,
      error: { code: "NETWORK" },
    });

    renderCalendar();

    expect(await screen.findByText(text("en").offline)).toBeOnTheScreen();
  });

  it("says so when the month has no slots", async () => {
    jest.mocked(api.fetchAvailability).mockResolvedValue({
      ok: true,
      data: { ...availability, days: [] },
    });

    renderCalendar();

    expect(await screen.findByText(text("en").noSlots)).toBeOnTheScreen();
  });

  it("disables days before the server's today", async () => {
    jest.mocked(api.fetchAvailability).mockResolvedValue({
      ok: true,
      data: { ...availability, today: "2026-11-25" },
    });

    renderCalendar();
    await screen.findByText("November 2026");

    expect(screen.getByTestId("day-2026-11-24")).toBeDisabled();
    expect(screen.getByTestId("day-2026-11-25")).not.toBeDisabled();
  });
});
