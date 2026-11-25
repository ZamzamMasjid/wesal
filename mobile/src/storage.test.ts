// SPEC: customer-mobile-app/spec.md — the app remembers booking tokens, the
// staff session and the chosen language on the device.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Scaffold Expo app with
// Arabic/English and RTL, consuming /api/v1

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import {
  clearDeviceId,
  clearStaffCookie,
  deviceId,
  forgetBooking,
  rememberBooking,
  saveDeviceId,
  savedLocale,
  saveLocale,
  saveStaffCookie,
  staffCookie,
  storedBookings,
} from "./storage";

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearStaffCookie();
  await clearDeviceId();
});

describe("stored bookings", () => {
  it("starts empty", async () => {
    await expect(storedBookings()).resolves.toEqual([]);
  });

  it("keeps the newest booking first with a saved timestamp", async () => {
    await rememberBooking({ token: "a", bookingId: "A1" });
    await rememberBooking({ token: "b", bookingId: "B1" });

    const rows = await storedBookings();
    expect(rows.map((row) => row.token)).toEqual(["b", "a"]);
    expect(rows[0]?.bookingId).toBe("B1");
    expect(Date.parse(rows[0]?.savedAt ?? "")).not.toBeNaN();
  });

  it("replaces a token instead of duplicating it", async () => {
    await rememberBooking({ token: "a", bookingId: "A1" });
    await rememberBooking({ token: "b", bookingId: "B1" });
    await rememberBooking({ token: "a", bookingId: "A2" });

    const rows = await storedBookings();
    expect(rows.map((row) => row.token)).toEqual(["a", "b"]);
    expect(rows[0]?.bookingId).toBe("A2");
  });

  it("keeps at most ten bookings", async () => {
    for (let index = 0; index < 12; index += 1) {
      await rememberBooking({ token: `t${index}`, bookingId: `B${index}` });
    }

    const rows = await storedBookings();
    expect(rows).toHaveLength(10);
    expect(rows[0]?.token).toBe("t11");
    expect(rows.at(-1)?.token).toBe("t2");
  });

  it("forgets one booking", async () => {
    await rememberBooking({ token: "a", bookingId: "A1" });
    await rememberBooking({ token: "b", bookingId: "B1" });

    await forgetBooking("a");

    await expect(storedBookings()).resolves.toMatchObject([
      { token: "b", bookingId: "B1" },
    ]);
  });

  it("survives corrupt or unexpected JSON", async () => {
    await AsyncStorage.setItem("wesal.bookings", "{not json");
    await expect(storedBookings()).resolves.toEqual([]);

    await AsyncStorage.setItem("wesal.bookings", JSON.stringify({ a: 1 }));
    await expect(storedBookings()).resolves.toEqual([]);
  });

  it("survives a storage read failure", async () => {
    jest
      .mocked(AsyncStorage.getItem)
      .mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(storedBookings()).resolves.toEqual([]);
  });
});

describe("staff session", () => {
  it("round-trips the cookie", async () => {
    await expect(staffCookie()).resolves.toBeNull();

    await saveStaffCookie("session=abc");
    await expect(staffCookie()).resolves.toBe("session=abc");

    await clearStaffCookie();
    await expect(staffCookie()).resolves.toBeNull();
  });

  it("returns null when SecureStore fails", async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error("keychain locked"));

    await expect(staffCookie()).resolves.toBeNull();
  });
});

describe("push device id", () => {
  it("round-trips the numeric id", async () => {
    await expect(deviceId()).resolves.toBeNull();

    await saveDeviceId(9);
    await expect(deviceId()).resolves.toBe(9);

    await clearDeviceId();
    await expect(deviceId()).resolves.toBeNull();
  });

  it("returns null when SecureStore fails", async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error("keychain locked"));

    await expect(deviceId()).resolves.toBeNull();
  });
});

describe("locale", () => {
  it("returns null until a valid locale is saved", async () => {
    await expect(savedLocale()).resolves.toBeNull();

    await saveLocale("en");
    await expect(savedLocale()).resolves.toBe("en");

    await AsyncStorage.setItem("wesal.locale", "fr");
    await expect(savedLocale()).resolves.toBeNull();
  });
});
