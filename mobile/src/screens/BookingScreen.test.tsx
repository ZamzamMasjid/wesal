// SPEC: customer-mobile-app/spec.md — the private booking page shows status,
// countdown and prices, finds a booking by number and uploads payment proof.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Implement calendar, booking
// form, booking page and proof upload screens

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";

import type { PublicBooking } from "../api";
import * as api from "../api";
import { text } from "../i18n";
import { BookingScreen } from "./BookingScreen";

jest.mock("../api", () => ({
  fetchBooking: jest.fn(),
  lookupBooking: jest.fn(),
  uploadProof: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

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
  deadlineAt: "2026-11-25T10:02:00Z",
  transfer: {
    vodafoneCashNumber: "01000000000",
    instapayAddress: "mona@instapay",
  },
  createdAt: "2026-11-25T09:55:00Z",
  refreshedAt: "2026-11-25T10:00:00Z",
};

function renderBooking(token: string | null, onBack = jest.fn()) {
  return render(
    <BookingScreen locale="en" t={text("en")} token={token} onBack={onBack} />,
  );
}

beforeEach(() => {
  jest.mocked(api.fetchBooking).mockResolvedValue({ ok: true, data: booking });
  jest.mocked(api.lookupBooking).mockResolvedValue({
    ok: true,
    data: { bookingId: "B-1", token: "tok-1" },
  });
  jest.mocked(api.uploadProof).mockResolvedValue({
    ok: true,
    data: { id: 1 },
  });
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: true,
    assets: [],
  } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("BookingScreen without a token", () => {
  it("looks a booking up by number and opens it", async () => {
    renderBooking(null);

    fireEvent.changeText(screen.getByLabelText(text("en").bookingId), "B-1");
    fireEvent.press(
      screen.getByRole("button", { name: text("en").findBooking }),
    );

    expect(await screen.findByText("Wedding")).toBeOnTheScreen();
    expect(api.lookupBooking).toHaveBeenCalledWith("B-1");
    expect(api.fetchBooking).toHaveBeenCalledWith("tok-1");
  });

  it("shows not-found when the number does not resolve", async () => {
    jest.mocked(api.lookupBooking).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    renderBooking(null);

    fireEvent.changeText(screen.getByLabelText(text("en").bookingId), "B-404");
    fireEvent.press(
      screen.getByRole("button", { name: text("en").findBooking }),
    );

    expect(await screen.findByText(text("en").notFound)).toBeOnTheScreen();
    expect(api.fetchBooking).not.toHaveBeenCalled();
  });

  it("returns to the home route", () => {
    const onBack = jest.fn();
    renderBooking(null, onBack);

    fireEvent.press(screen.getByText(text("en").back));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("BookingScreen with a token", () => {
  it("shows the booking, countdown, prices and transfer methods", async () => {
    renderBooking("tok-1");

    expect(await screen.findByText("Wedding")).toBeOnTheScreen();
    expect(api.fetchBooking).toHaveBeenCalledWith("tok-1");
    expect(screen.getByText(text("en").awaitingPayment)).toBeOnTheScreen();
    expect(screen.getByText(/B-1/)).toBeOnTheScreen();
    expect(screen.getByText("Time left: 02:00")).toBeOnTheScreen();
    expect(screen.getByText(/1,500/)).toBeOnTheScreen();
    expect(screen.getByText(/300/)).toBeOnTheScreen();
    expect(screen.getByText(/1,200/)).toBeOnTheScreen();
    expect(screen.getByText("Vodafone Cash")).toBeOnTheScreen();
    expect(screen.getByText("01000000000")).toBeOnTheScreen();
    expect(screen.getByText("InstaPay")).toBeOnTheScreen();
    expect(screen.getByText("mona@instapay")).toBeOnTheScreen();
  });

  it("refreshes the booking on demand", async () => {
    renderBooking("tok-1");
    await screen.findByText("Wedding");

    fireEvent.press(screen.getByText(text("en").refresh));

    await waitFor(() => {
      expect(api.fetchBooking).toHaveBeenCalledTimes(2);
    });
    expect(api.fetchBooking).toHaveBeenLastCalledWith("tok-1");
  });

  it("handles a confirmed booking with no payment method", async () => {
    jest.mocked(api.fetchBooking).mockResolvedValue({
      ok: true,
      data: {
        ...booking,
        status: "confirmed",
        deadlineAt: null,
        transfer: null,
        remainderPaid: true,
      },
    });

    renderBooking("tok-1");

    expect(await screen.findByText("Wedding")).toBeOnTheScreen();
    expect(screen.getByText(text("en").confirmed)).toBeOnTheScreen();
    expect(screen.getByText(text("en").remainderPaid)).toBeOnTheScreen();
    expect(screen.getByText(text("en").paymentUnavailable)).toBeOnTheScreen();
    expect(screen.queryByText(text("en").proof)).not.toBeOnTheScreen();
  });

  it("ticks the hold countdown down to the end", async () => {
    jest.useFakeTimers();
    renderBooking("tok-1");
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Time left: 02:00")).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Time left: 01:59")).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(screen.getByText(text("en").timeUp)).toBeOnTheScreen();
  });

  it("shows not-found when the token cannot be loaded", async () => {
    jest.mocked(api.fetchBooking).mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND" },
    });

    renderBooking("tok-1");

    expect(
      await screen.findByText(text("en").bookingNotFound),
    ).toBeOnTheScreen();
  });
});

describe("proof upload", () => {
  it("does nothing when photo permission is refused", async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ granted: false } as never);
    renderBooking("tok-1");
    await screen.findByText(text("en").proof);

    fireEvent.press(screen.getByText(text("en").uploadProof));

    await waitFor(() => {
      expect(
        ImagePicker.requestMediaLibraryPermissionsAsync,
      ).toHaveBeenCalled();
    });
    expect(api.uploadProof).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is cancelled", async () => {
    renderBooking("tok-1");
    await screen.findByText(text("en").proof);

    fireEvent.press(screen.getByText(text("en").uploadProof));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
    expect(api.uploadProof).not.toHaveBeenCalled();
  });

  it("uploads the picked image and refreshes the booking", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///proof.jpg",
          mimeType: "image/jpeg",
          fileName: "proof.jpg",
        },
      ],
    } as never);
    renderBooking("tok-1");
    await screen.findByText(text("en").proof);

    fireEvent.press(screen.getByText(text("en").uploadProof));

    expect(await screen.findByText(text("en").proofReceived)).toBeOnTheScreen();
    expect(api.uploadProof).toHaveBeenCalledWith("tok-1", {
      uri: "file:///proof.jpg",
      mimeType: "image/jpeg",
      fileName: "proof.jpg",
    });
    await waitFor(() => {
      expect(api.fetchBooking).toHaveBeenCalledTimes(2);
    });
  });

  it("falls back to default image metadata and reports a failed upload", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///proof.heic" }],
    } as never);
    jest.mocked(api.uploadProof).mockResolvedValue({
      ok: false,
      error: { code: "NETWORK" },
    });
    renderBooking("tok-1");
    await screen.findByText(text("en").proof);

    fireEvent.press(screen.getByText(text("en").uploadProof));

    expect(await screen.findByText(text("en").proofFailed)).toBeOnTheScreen();
    expect(api.uploadProof).toHaveBeenCalledWith("tok-1", {
      uri: "file:///proof.heic",
      mimeType: "image/jpeg",
      fileName: "proof.jpg",
    });
  });
});
