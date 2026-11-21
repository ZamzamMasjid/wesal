import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// What the app remembers on the device (docs/features/customer-mobile-app):
// the link tokens of bookings made here, the staff session cookie and the
// registered push device id. Uninstalling clears all of it.

const BOOKINGS = "wesal.bookings";
const COOKIE = "wesal.staff.cookie";
const DEVICE = "wesal.staff.device";
const LOCALE = "wesal.locale";

export interface StoredBooking {
  token: string;
  bookingId: string;
  savedAt: string;
}

export async function storedBookings(): Promise<StoredBooking[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKINGS);
    const parsed = raw ? (JSON.parse(raw) as StoredBooking[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function rememberBooking(booking: {
  token: string;
  bookingId: string;
}): Promise<void> {
  const existing = await storedBookings();
  const next = [
    { ...booking, savedAt: new Date().toISOString() },
    ...existing.filter((row) => row.token !== booking.token),
  ].slice(0, 10);
  await AsyncStorage.setItem(BOOKINGS, JSON.stringify(next));
}

export async function forgetBooking(token: string): Promise<void> {
  const next = (await storedBookings()).filter((row) => row.token !== token);
  await AsyncStorage.setItem(BOOKINGS, JSON.stringify(next));
}

export async function staffCookie(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(COOKIE);
  } catch {
    return null;
  }
}

export async function saveStaffCookie(cookie: string): Promise<void> {
  await SecureStore.setItemAsync(COOKIE, cookie);
}

export async function clearStaffCookie(): Promise<void> {
  await SecureStore.deleteItemAsync(COOKIE);
}

export async function deviceId(): Promise<number | null> {
  try {
    const value = await SecureStore.getItemAsync(DEVICE);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

export async function saveDeviceId(id: number): Promise<void> {
  await SecureStore.setItemAsync(DEVICE, String(id));
}

export async function clearDeviceId(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE);
}

export async function savedLocale(): Promise<"ar" | "en" | null> {
  const value = await AsyncStorage.getItem(LOCALE);
  return value === "ar" || value === "en" ? value : null;
}

export async function saveLocale(locale: "ar" | "en"): Promise<void> {
  await AsyncStorage.setItem(LOCALE, locale);
}
