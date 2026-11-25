// SPEC: customer-mobile-app/spec.md — the booking form collects the customer,
// verifies the phone and creates the hold, then links to the booking page.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Implement calendar, booking
// form, booking page and proof upload screens

import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Occasion } from "../api";
import * as api from "../api";
import { text } from "../i18n";
import * as storage from "../storage";
import { BookingFormScreen } from "./BookingFormScreen";

jest.mock("../api", () => ({
  requestVerificationCode: jest.fn(),
  checkVerificationCode: jest.fn(),
  createHold: jest.fn(),
}));

jest.mock("../storage", () => ({
  rememberBooking: jest.fn(),
}));

const occasions: Occasion[] = [
  { id: 1, nameAr: "زفاف", nameEn: "Wedding", priceEgp: 1500, position: 0 },
  { id: 2, nameAr: "عقيقة", nameEn: "Aqiqa", priceEgp: 2000, position: 1 },
];

const hold = {
  bookingId: "B-1",
  linkToken: "tok-1",
  deadlineAt: "2026-11-25T10:20:00Z",
  priceEgp: 1500,
  depositEgp: 300,
  urgent: false,
};

function renderForm(
  overrides: {
    onHeld?: (token: string) => void;
    onBack?: () => void;
    onCalendar?: () => void;
  } = {},
) {
  return render(
    <BookingFormScreen
      locale="en"
      t={text("en")}
      day="2026-11-25"
      start="10:00"
      end="12:00"
      occasions={occasions}
      onHeld={overrides.onHeld ?? jest.fn()}
      onBack={overrides.onBack ?? jest.fn()}
      onCalendar={overrides.onCalendar ?? jest.fn()}
    />,
  );
}

function fillDetails(name = "Mona", phone = "01000000000") {
  fireEvent.changeText(screen.getByLabelText(text("en").name), name);
  fireEvent.changeText(screen.getByLabelText(text("en").phone), phone);
}

beforeEach(() => {
  jest.mocked(api.requestVerificationCode).mockResolvedValue({
    ok: true,
    data: {
      phone: "01000000000",
      channel: "whatsapp",
      resendAt: "2026-11-25T09:01:00Z",
    },
  });
  jest.mocked(api.checkVerificationCode).mockResolvedValue({
    ok: true,
    data: {
      token: "verified",
      phone: "01000000000",
      expiresAt: "2026-11-25T09:10:00Z",
    },
  });
  jest.mocked(api.createHold).mockResolvedValue({ ok: true, data: hold });
});

describe("BookingFormScreen", () => {
  it("requires a name, phone and occasion before sending a code", () => {
    renderForm();

    fireEvent.press(screen.getByText(text("en").sendCode));

    expect(screen.getByText(text("en").required)).toBeOnTheScreen();
    expect(api.requestVerificationCode).not.toHaveBeenCalled();
  });

  it("sends the code, verifies it, creates the hold and remembers it", async () => {
    const onHeld = jest.fn();
    renderForm({ onHeld });
    fillDetails();

    fireEvent.press(screen.getByText(text("en").sendCode));

    expect(
      await screen.findByText("We sent a code to 01000000000"),
    ).toBeOnTheScreen();
    expect(api.requestVerificationCode).toHaveBeenCalledWith(
      "01000000000",
      "en",
    );

    fireEvent.changeText(screen.getByLabelText(text("en").code), "1234");
    fireEvent.press(screen.getByText(text("en").bookingNow));

    expect(await screen.findByText(text("en").held)).toBeOnTheScreen();
    expect(api.checkVerificationCode).toHaveBeenCalledWith(
      "01000000000",
      "1234",
    );
    expect(api.createHold).toHaveBeenCalledWith({
      day: "2026-11-25",
      start: "10:00",
      end: "12:00",
      occasionId: 1,
      name: "Mona",
      phone: "01000000000",
      token: "verified",
      locale: "en",
    });
    expect(storage.rememberBooking).toHaveBeenCalledWith({
      token: "tok-1",
      bookingId: "B-1",
    });
    expect(screen.getByText(/B-1/)).toBeOnTheScreen();

    fireEvent.press(screen.getByText(text("en").openBooking));
    expect(onHeld).toHaveBeenCalledWith("tok-1");
  });

  it("lets the customer choose another occasion", async () => {
    renderForm();

    expect(screen.getByText("Occasion price: 1500 EGP")).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Aqiqa · 2000 EGP"));

    expect(screen.getByText("Occasion price: 2000 EGP")).toBeOnTheScreen();
  });

  it("maps a refused code to the right message and allows a retry", async () => {
    jest.mocked(api.checkVerificationCode).mockResolvedValue({
      ok: false,
      error: { code: "CODE_INVALID" },
    });
    renderForm();
    fillDetails();
    fireEvent.press(screen.getByText(text("en").sendCode));
    await screen.findByText("We sent a code to 01000000000");

    fireEvent.changeText(screen.getByLabelText(text("en").code), "0000");
    fireEvent.press(screen.getByText(text("en").bookingNow));

    expect(await screen.findByText(text("en").codeInvalid)).toBeOnTheScreen();
    expect(api.createHold).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText(text("en").changeNumber));

    expect(screen.getByLabelText(text("en").name)).toBeOnTheScreen();
    expect(screen.queryByLabelText(text("en").code)).not.toBeOnTheScreen();
  });

  it("maps a phone that already holds a booking", async () => {
    jest.mocked(api.requestVerificationCode).mockResolvedValue({
      ok: false,
      error: { code: "PHONE_HOLD_EXISTS" },
    });
    renderForm();
    fillDetails();

    fireEvent.press(screen.getByText(text("en").sendCode));

    expect(await screen.findByText(text("en").phoneHold)).toBeOnTheScreen();
  });

  it("maps a slot taken while verifying to the right message", async () => {
    jest.mocked(api.createHold).mockResolvedValue({
      ok: false,
      error: { code: "SLOT_TAKEN" },
    });
    renderForm();
    fillDetails();
    fireEvent.press(screen.getByText(text("en").sendCode));
    await screen.findByText("We sent a code to 01000000000");

    fireEvent.changeText(screen.getByLabelText(text("en").code), "1234");
    fireEvent.press(screen.getByText(text("en").bookingNow));

    expect(await screen.findByText(text("en").slotTaken)).toBeOnTheScreen();
    expect(storage.rememberBooking).not.toHaveBeenCalled();
  });

  it("goes back from the form and from the held screen", async () => {
    const onBack = jest.fn();
    const onCalendar = jest.fn();
    renderForm({ onBack, onCalendar });
    fillDetails();
    fireEvent.press(screen.getByText(text("en").sendCode));
    await screen.findByText("We sent a code to 01000000000");
    fireEvent.changeText(screen.getByLabelText(text("en").code), "1234");
    fireEvent.press(screen.getByText(text("en").bookingNow));
    await screen.findByText(text("en").held);

    fireEvent.press(screen.getByText(text("en").back));

    expect(onCalendar).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });
});
