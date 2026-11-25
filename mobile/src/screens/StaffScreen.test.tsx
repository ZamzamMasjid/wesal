// SPEC: customer-mobile-app/spec.md — staff sign in on the app, register the
// device for push alerts, read the review queue and sign out.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Scaffold Expo app with
// Arabic/English and RTL, consuming /api/v1

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

import * as api from "../api";
import { text } from "../i18n";
import * as storage from "../storage";
import { StaffScreen } from "./StaffScreen";

jest.mock("../api", () => ({
  fetchReviewQueue: jest.fn(),
  registerDevice: jest.fn(),
  signIn: jest.fn(),
  staffMe: jest.fn(),
  unregisterDevice: jest.fn(),
}));

jest.mock("../storage", () => ({
  clearDeviceId: jest.fn(),
  clearStaffCookie: jest.fn(),
  deviceId: jest.fn(),
  saveDeviceId: jest.fn(),
  saveStaffCookie: jest.fn(),
  staffCookie: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: "http://api.test",
        eas: { projectId: "project-123" },
      },
    },
  },
}));

const profile = { id: "s1", name: "Sara", role: "staff" as const };
const queueItem = {
  bookingId: "B-1",
  status: "held" as const,
  customerName: "Mona",
  day: "2026-11-25",
  start: "10:00",
  end: "12:00",
  occasion: { nameAr: "زفاف", nameEn: "Wedding" },
  waitingSince: "2026-11-25T09:55:00Z",
};

function renderStaff(onBack = jest.fn()) {
  return render(<StaffScreen locale="en" t={text("en")} onBack={onBack} />);
}

function fillLogin() {
  fireEvent.changeText(screen.getByLabelText(text("en").username), "owner");
  fireEvent.changeText(screen.getByLabelText(text("en").password), "secret");
}

beforeEach(() => {
  jest.mocked(storage.staffCookie).mockResolvedValue(null);
  jest.mocked(storage.deviceId).mockResolvedValue(null);
  jest.mocked(api.staffMe).mockResolvedValue({ ok: true, data: profile });
  jest.mocked(api.fetchReviewQueue).mockResolvedValue({
    ok: true,
    data: { items: [], refreshedAt: "2026-11-25T10:00:00Z" },
  });
  jest.mocked(api.signIn).mockResolvedValue({
    ok: true,
    data: { cookie: "session=abc" },
  });
  jest.mocked(api.registerDevice).mockResolvedValue({
    ok: true,
    data: { id: 9, platform: "ios" },
  });
  jest
    .mocked(Notifications.requestPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
    data: "ExponentPushToken[test]",
  } as never);
});

describe("StaffScreen", () => {
  it("shows the login form when no saved session is valid", async () => {
    jest.mocked(storage.staffCookie).mockResolvedValue("session=old");
    jest.mocked(api.staffMe).mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });

    renderStaff();

    expect(await screen.findByText(text("en").staffLogin)).toBeOnTheScreen();
    expect(api.staffMe).toHaveBeenCalledWith("session=old");
    expect(screen.getByLabelText(text("en").username)).toBeOnTheScreen();
  });

  it("opens with a saved session and shows the review queue", async () => {
    jest.mocked(storage.staffCookie).mockResolvedValue("session=saved");
    jest.mocked(api.fetchReviewQueue).mockResolvedValue({
      ok: true,
      data: { items: [queueItem], refreshedAt: "2026-11-25T10:00:00Z" },
    });

    renderStaff();

    expect(await screen.findByText("Sara")).toBeOnTheScreen();
    expect(api.staffMe).toHaveBeenCalledWith("session=saved");
    expect(api.fetchReviewQueue).toHaveBeenCalledWith("session=saved");
    expect(screen.getByText(/Mona · B-1/)).toBeOnTheScreen();
  });

  it("reports bad credentials", async () => {
    jest.mocked(api.signIn).mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    renderStaff();
    fillLogin();

    fireEvent.press(screen.getByText(text("en").login));

    expect(await screen.findByText(text("en").loginFailed)).toBeOnTheScreen();
    expect(storage.saveStaffCookie).not.toHaveBeenCalled();
  });

  it("reports a rate limit separately", async () => {
    jest.mocked(api.signIn).mockResolvedValue({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
    renderStaff();
    fillLogin();

    fireEvent.press(screen.getByText(text("en").login));

    expect(await screen.findByText(text("en").genericError)).toBeOnTheScreen();
  });

  it("signs in, saves the session and registers the device for push", async () => {
    renderStaff();
    await screen.findByText(text("en").staffLogin);
    fillLogin();

    fireEvent.press(screen.getByText(text("en").login));

    expect(await screen.findByText("Sara")).toBeOnTheScreen();
    expect(storage.saveStaffCookie).toHaveBeenCalledWith("session=abc");
    expect(api.registerDevice).toHaveBeenCalledWith(
      "session=abc",
      "ExponentPushToken[test]",
      "ios",
    );
    expect(storage.saveDeviceId).toHaveBeenCalledWith(9);
    expect(await screen.findByText(text("en").pushReady)).toBeOnTheScreen();
  });

  it("says push is unavailable when permission is refused", async () => {
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValue({ granted: false } as never);
    renderStaff();
    await screen.findByText(text("en").staffLogin);
    fillLogin();

    fireEvent.press(screen.getByText(text("en").login));

    expect(
      await screen.findByText(text("en").pushUnavailable),
    ).toBeOnTheScreen();
    expect(api.registerDevice).not.toHaveBeenCalled();
  });

  it("signs out, unregisters the device and clears the session", async () => {
    jest.mocked(storage.staffCookie).mockResolvedValue("session=saved");
    jest.mocked(storage.deviceId).mockResolvedValue(5);
    renderStaff();
    await screen.findByText("Sara");

    fireEvent.press(screen.getByText(text("en").logout));

    expect(await screen.findByText(text("en").staffLogin)).toBeOnTheScreen();
    expect(api.unregisterDevice).toHaveBeenCalledWith("session=saved", 5);
    expect(storage.clearDeviceId).toHaveBeenCalled();
    expect(storage.clearStaffCookie).toHaveBeenCalled();
  });

  it("returns to the home route from the login form", async () => {
    const onBack = jest.fn();
    renderStaff(onBack);
    await screen.findByText(text("en").staffLogin);

    fireEvent.press(screen.getByText(text("en").back));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
