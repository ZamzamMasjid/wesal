// SPEC: docs/features/booking-hold — the booking-link message points at the customer's private booking page in their own language
// ROADMAP: phase-3-booking / booking-hold / Queue the booking-link message on hold creation
import { describe, expect, it } from "vitest";

import { absoluteBookingLink, bookingPath } from "./booking-link";

describe("bookingPath", () => {
  it("has no locale prefix for Arabic and /en for English", () => {
    expect(bookingPath("ar", "abc")).toBe("/booking/abc");
    expect(bookingPath("en", "abc")).toBe("/en/booking/abc");
  });

  it("encodes the token so the link cannot break", () => {
    expect(bookingPath("ar", "a/b c")).toBe("/booking/a%2Fb%20c");
  });
});

describe("absoluteBookingLink", () => {
  it("joins the public origin without doubling the slash", () => {
    expect(absoluteBookingLink("https://wesal.example/", "ar", "abc")).toBe(
      "https://wesal.example/booking/abc",
    );
    expect(absoluteBookingLink("https://wesal.example", "en", "abc")).toBe(
      "https://wesal.example/en/booking/abc",
    );
  });
});
