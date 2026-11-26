// SPEC: customer-mobile-app/spec.md — the tab shell, language switch and route
// state around the four customer screens and the staff screen.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Scaffold Expo app with
// Arabic/English and RTL, consuming /api/v1

import { fireEvent, render, screen } from "@testing-library/react-native";

import App from "./App";
import type { Availability, PublicBooking, SiteContent } from "./src/api";
import * as api from "./src/api";
import * as storage from "./src/storage";

jest.mock("./src/api", () => ({
  absoluteUrl: (path: string) => `http://api.test${path}`,
  fetchAvailability: jest.fn(),
  fetchBooking: jest.fn(),
  fetchContent: jest.fn(),
  fetchOccasions: jest.fn(),
  lookupBooking: jest.fn(),
  uploadProof: jest.fn(),
}));

jest.mock("./src/storage", () => ({
  savedLocale: jest.fn(),
  saveLocale: jest.fn(),
  storedBookings: jest.fn(),
}));

const content: SiteContent = {
  descriptionAr: "قاعة للاحتفالات",
  descriptionEn: "A hall for celebrations",
  policyAr: "",
  policyEn: "",
  contactPhone: "",
  contactWhatsapp: "",
};

const availability: Availability = {
  from: "2026-11-01",
  to: "2026-11-30",
  today: "2026-11-25",
  refreshedAt: "2026-11-25T08:00:00Z",
  days: [],
};

const booking: PublicBooking = {
  bookingId: "B-1",
  status: "held",
  occasion: { nameAr: "زفاف", nameEn: "Wedding" },
  customerName: "Mona",
  day: "2026-11-25",
  start: "10:00",
  end: "12:00",
  priceEgp: 1500,
  depositEgp: 300,
  remainderEgp: 1200,
  remainderPaid: false,
  deadlineAt: null,
  transfer: null,
  createdAt: "2026-11-25T09:55:00Z",
  refreshedAt: "2026-11-25T10:00:00Z",
};

beforeEach(() => {
  jest.mocked(storage.savedLocale).mockResolvedValue(null);
  jest.mocked(storage.storedBookings).mockResolvedValue([]);
  jest.mocked(api.fetchContent).mockResolvedValue({
    ok: true,
    data: { content, media: [] },
  });
  jest.mocked(api.fetchOccasions).mockResolvedValue({
    ok: true,
    data: { occasions: [] },
  });
  jest.mocked(api.fetchAvailability).mockResolvedValue({
    ok: true,
    data: availability,
  });
  jest.mocked(api.fetchBooking).mockResolvedValue({ ok: true, data: booking });
  jest.mocked(api.lookupBooking).mockResolvedValue({
    ok: true,
    data: { bookingId: "B-1", token: "tok-1" },
  });
});

describe("App", () => {
  it("starts in Arabic and switches both ways from the header", async () => {
    render(<App />);

    expect((await screen.findAllByText("وصال")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "English" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "English" }));

    expect((await screen.findAllByText("Wesal")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "العربية" })).toBeOnTheScreen();
    expect(storage.saveLocale).toHaveBeenLastCalledWith("en");

    fireEvent.press(screen.getByRole("button", { name: "العربية" }));

    expect((await screen.findAllByText("وصال")).length).toBeGreaterThan(0);
    expect(storage.saveLocale).toHaveBeenLastCalledWith("ar");
  });

  it("opens in the saved language", async () => {
    jest.mocked(storage.savedLocale).mockResolvedValue("en");

    render(<App />);

    expect((await screen.findAllByText("Wesal")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "العربية" })).toBeOnTheScreen();
  });

  it("sets the shell direction from the chosen language", async () => {
    render(<App />);
    await screen.findAllByText("وصال");

    expect(screen.getByTestId("app-root")).toHaveStyle({ direction: "rtl" });

    fireEvent.press(screen.getByRole("button", { name: "English" }));

    expect((await screen.findAllByText("Wesal")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("app-root")).toHaveStyle({ direction: "ltr" });
  });

  it("moves between the home, calendar and booking tabs", async () => {
    render(<App />);
    await screen.findAllByText("وصال");

    fireEvent.press(screen.getByRole("tab", { name: "التقويم" }));

    expect(
      await screen.findByText("لا مواعيد في هذا اليوم."),
    ).toBeOnTheScreen();
    expect(api.fetchAvailability).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "التقويم" })).toHaveProp(
      "accessibilityState",
      { selected: true },
    );

    fireEvent.press(screen.getByRole("tab", { name: "حجزي" }));

    expect(await screen.findByLabelText("رقم الحجز")).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("tab", { name: "الرئيسية" }));

    expect(
      (await screen.findAllByText("مسجد وصال وقاعة المناسبات")).length,
    ).toBeGreaterThan(0);
  });

  it("opens the booking saved on the device", async () => {
    jest
      .mocked(storage.storedBookings)
      .mockResolvedValue([
        { token: "tok-1", bookingId: "B-1", savedAt: "2026-11-25T10:00:00Z" },
      ]);
    render(<App />);

    fireEvent.press(await screen.findByText("حجزك الحالي"));

    expect(await screen.findByText("زفاف")).toBeOnTheScreen();
    expect(api.fetchBooking).toHaveBeenCalledWith("tok-1");
  });
});
