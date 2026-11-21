// SPEC: docs/features/payment-review — the queue shows how long each payment has waited, oldest first
// ROADMAP: phase-4-operations / payment-review / Implement review-queue view with screenshot viewer and confirm/reject actions
import { describe, expect, it } from "vitest";

import {
  proofFileHref,
  reviewHref,
  waitingMinutes,
  waitingUnit,
} from "./review-api";

describe("waitingMinutes", () => {
  it("counts whole minutes against the server's own clock", () => {
    expect(
      waitingMinutes("2026-12-20T08:00:00.000Z", "2026-12-20T08:04:30.000Z"),
    ).toBe(4);
  });

  it("never reports a negative wait or a broken answer", () => {
    expect(
      waitingMinutes("2026-12-20T09:00:00.000Z", "2026-12-20T08:00:00.000Z"),
    ).toBe(0);
    expect(waitingMinutes("not a date", "2026-12-20T08:00:00.000Z")).toBe(0);
  });
});

describe("waitingUnit", () => {
  it("uses minutes under an hour, hours under a day, then days", () => {
    expect(waitingUnit(0)).toEqual({ unit: "minutes", count: 0 });
    expect(waitingUnit(59)).toEqual({ unit: "minutes", count: 59 });
    expect(waitingUnit(60)).toEqual({ unit: "hours", count: 1 });
    expect(waitingUnit(23 * 60 + 59)).toEqual({ unit: "hours", count: 23 });
    expect(waitingUnit(24 * 60)).toEqual({ unit: "days", count: 1 });
    expect(waitingUnit(3 * 24 * 60 + 90)).toEqual({ unit: "days", count: 3 });
  });
});

describe("paths", () => {
  it("keeps the booking code in the review path and the screenshot behind staff", () => {
    expect(reviewHref("ABC234")).toBe("/dashboard/review/ABC234");
    expect(reviewHref("A/B")).toBe("/dashboard/review/A%2FB");
    expect(proofFileHref(42)).toBe("/api/v1/staff/proofs/42/file");
  });
});
