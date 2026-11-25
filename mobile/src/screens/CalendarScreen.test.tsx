// SPEC: customer-mobile-app/spec.md — the calendar lists each open day, marks
// which slots are bookable, and lets the customer move between months.
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

function renderCalendar(onBook = jest.fn()) {
  return render(<CalendarScreen locale="en" t={text("en")} onBook={onBook} />);
}

beforeEach(() => {
  jest.mocked(api.fetchAvailability).mockResolvedValue({
    ok: true,
    data: availability,
  });
});

describe("CalendarScreen", () => {
  it("loads the visible month and shows its open days", async () => {
    renderCalendar();

    expect(screen.getByText(text("en").sending)).toBeOnTheScreen();
    expect(await screen.findByText("Wednesday 25 Nov")).toBeOnTheScreen();
    expect(screen.getByText("November 2026")).toBeOnTheScreen();
    expect(api.fetchAvailability).toHaveBeenCalledWith(
      "2026-11-01",
      "2026-11-30",
    );
    expect(screen.queryByText("Thursday 26 Nov")).not.toBeOnTheScreen();
  });

  it("marks free slots as bookable and reports the chosen one", async () => {
    const onBook = jest.fn();
    renderCalendar(onBook);

    expect(await screen.findByText("Book")).toBeOnTheScreen();
    expect(screen.getByText("Awaiting payment")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Book"));

    expect(onBook).toHaveBeenCalledWith("2026-11-25", freeSlot);
  });

  it("moves to the next and previous month", async () => {
    renderCalendar();
    await screen.findByText("November 2026");

    fireEvent.press(screen.getByRole("button", { name: "›" }));

    await waitFor(() => {
      expect(api.fetchAvailability).toHaveBeenLastCalledWith(
        "2026-12-01",
        "2026-12-31",
      );
    });
    expect(screen.getByText("December 2026")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "‹" }));

    await waitFor(() => {
      expect(api.fetchAvailability).toHaveBeenLastCalledWith(
        "2026-11-01",
        "2026-11-30",
      );
    });
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

  it("shows the venue day when the server's today differs", async () => {
    jest.mocked(api.fetchAvailability).mockResolvedValue({
      ok: true,
      data: { ...availability, today: "2026-11-24" },
    });

    renderCalendar();

    expect(
      await screen.findByText(`${text("en").availability} · 2026-11-25`),
    ).toBeOnTheScreen();
  });
});
