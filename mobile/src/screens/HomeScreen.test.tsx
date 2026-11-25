// SPEC: customer-mobile-app/spec.md — the home screen shows the venue, its
// photos, prices and the booking saved on this device, and works offline.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Implement calendar, booking
// form, booking page and proof upload screens

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import type { MediaItem, Occasion, SiteContent } from "../api";
import * as api from "../api";
import { text, type Locale } from "../i18n";
import * as storage from "../storage";
import { HomeScreen } from "./HomeScreen";

jest.mock("../api", () => ({
  absoluteUrl: (path: string) => `http://api.test${path}`,
  fetchContent: jest.fn(),
  fetchOccasions: jest.fn(),
}));

jest.mock("../storage", () => ({
  storedBookings: jest.fn(),
}));

const content: SiteContent = {
  descriptionAr: "قاعة للاحتفالات",
  descriptionEn: "A hall for celebrations",
  policyAr: "",
  policyEn: "",
  contactPhone: "+20 100 000 0000",
  contactWhatsapp: "+20 100 000 0001",
};

const media: MediaItem[] = [
  {
    id: 1,
    kind: "photo",
    position: 0,
    altAr: "صورة القاعة",
    altEn: "The hall",
    url: "/uploads/hall.jpg",
    mimeType: "image/jpeg",
  },
  {
    id: 2,
    kind: "video",
    position: 1,
    altAr: "فيديو",
    altEn: "A video",
    url: "/uploads/hall.mp4",
    mimeType: "video/mp4",
  },
];

const occasions: Occasion[] = [
  { id: 1, nameAr: "زفاف", nameEn: "Wedding", priceEgp: 1500, position: 0 },
  { id: 2, nameAr: "عقيقة", nameEn: "Aqiqa", priceEgp: 900, position: 1 },
];

function renderHome(
  locale: Locale = "en",
  overrides: {
    onCalendar?: () => void;
    onBooking?: (token: string) => void;
    onStaff?: () => void;
  } = {},
) {
  const t = text(locale);
  return render(
    <HomeScreen
      locale={locale}
      t={t}
      onCalendar={overrides.onCalendar ?? jest.fn()}
      onBooking={overrides.onBooking ?? jest.fn()}
      onStaff={overrides.onStaff ?? jest.fn()}
    />,
  );
}

beforeEach(() => {
  jest.mocked(storage.storedBookings).mockResolvedValue([]);
  jest.mocked(api.fetchContent).mockResolvedValue({
    ok: true,
    data: { content, media },
  });
  jest.mocked(api.fetchOccasions).mockResolvedValue({
    ok: true,
    data: { occasions },
  });
});

describe("HomeScreen", () => {
  it("shows the venue, only photo media, prices and contact actions", async () => {
    renderHome("en");

    expect(await screen.findByText(content.descriptionEn)).toBeOnTheScreen();
    expect(screen.getByText("Wedding")).toBeOnTheScreen();
    expect(screen.getByText("Aqiqa")).toBeOnTheScreen();
    expect(screen.getByText(/1,500/)).toBeOnTheScreen();
    expect(screen.getByText(/900/)).toBeOnTheScreen();
    expect(screen.getByLabelText("The hall")).toBeOnTheScreen();
    expect(screen.queryByLabelText("A video")).not.toBeOnTheScreen();
  });

  it("shows the latest booking saved on the device and opens it", async () => {
    const onBooking = jest.fn();
    jest.mocked(storage.storedBookings).mockResolvedValue([
      { token: "tok-1", bookingId: "B-1", savedAt: "2026-11-25T10:00:00Z" },
      { token: "tok-0", bookingId: "B-0", savedAt: "2026-11-24T10:00:00Z" },
    ]);

    renderHome("en", { onBooking });

    expect(await screen.findByText(/B-1/)).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Open ›"));

    expect(onBooking).toHaveBeenCalledWith("tok-1");
  });

  it("shows the offline banner when content cannot be loaded", async () => {
    jest.mocked(api.fetchContent).mockResolvedValue({
      ok: false,
      error: { code: "NETWORK" },
    });
    jest.mocked(api.fetchOccasions).mockResolvedValue({
      ok: false,
      error: { code: "NETWORK" },
    });

    renderHome("en");

    const offline = await screen.findAllByText(text("en").offline);
    expect(offline.length).toBeGreaterThan(0);
    expect(screen.queryByText(content.descriptionEn)).not.toBeOnTheScreen();
  });

  it("routes the availability and staff actions", async () => {
    const onCalendar = jest.fn();
    const onStaff = jest.fn();
    renderHome("en", { onCalendar, onStaff });

    await screen.findByText(content.descriptionEn);

    fireEvent.press(screen.getByText(text("en").checkAvailability));
    fireEvent.press(screen.getByText(text("en").staffLogin));

    expect(onCalendar).toHaveBeenCalledTimes(1);
    expect(onStaff).toHaveBeenCalledTimes(1);
  });

  it("opens the phone and WhatsApp links with a cleaned number", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderHome("en");

    await screen.findByText(content.descriptionEn);

    fireEvent.press(screen.getByText(text("en").call));
    fireEvent.press(screen.getByText(text("en").whatsapp));

    expect(openURL).toHaveBeenNthCalledWith(1, `tel:${content.contactPhone}`);
    expect(openURL).toHaveBeenNthCalledWith(2, "https://wa.me/201000000001");
  });

  it("renders the Arabic description and accessible photo label", async () => {
    renderHome("ar");

    expect(await screen.findByText(content.descriptionAr)).toBeOnTheScreen();
    expect(screen.getByLabelText("صورة القاعة")).toBeOnTheScreen();
    expect(screen.getByText("زفاف")).toBeOnTheScreen();
  });
});
