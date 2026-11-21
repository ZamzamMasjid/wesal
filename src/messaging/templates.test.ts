// SPEC: message-delivery/spec.md — messages are written from templates in Arabic and English and sent in the recipient's language
// ROADMAP: phase-2-foundations / message-delivery / Add bilingual message templates: code, booking link, staff alert
import { describe, expect, it } from "vitest";

import {
  renderTemplate,
  TEMPLATE_NAMES,
  type TemplateName,
  type TemplateValues,
} from "./templates";

const SAMPLE: { [T in TemplateName]: TemplateValues<T> } = {
  code: { code: "123456", minutes: "10" },
  "booking-link": {
    link: "https://wesal.example/ar/b/abc",
    deadlineAt: "2026-12-24T16:20:00Z",
  },
  "booking-confirmed": {
    link: "https://wesal.example/ar/b/abc",
  },
  "staff-alert": {
    kind: "proof",
    link: "https://wesal.example/ar/dashboard/bookings/7",
    occasion: "Birthday",
    slotStartAt: "2026-12-24T16:30:00Z",
    customerName: "Mona",
    depositEgp: "500",
  },
  "slot-alert": {
    link: "https://wesal.example/book?day=2026-12-24&start=18%3A30&end=21%3A00",
    unsubscribe: "https://wesal.example/alerts/unsubscribe/tok",
    slotStartAt: "2026-12-24T16:30:00Z",
  },
};

const render = (
  template: TemplateName,
  locale: "ar" | "en",
  values: unknown = SAMPLE[template],
) => renderTemplate(template, locale, values as never);

describe("message templates", () => {
  it("has a sample for every template", () => {
    expect(Object.keys(SAMPLE).sort()).toEqual([...TEMPLATE_NAMES].sort());
  });

  it.each(
    TEMPLATE_NAMES.flatMap((t) => [[t, "ar"] as const, [t, "en"] as const]),
  )(
    "%s renders in %s with its values and no unfilled placeholders",
    (template, locale) => {
      const body = render(template, locale);
      expect(body.length).toBeGreaterThan(10);
      expect(body).not.toMatch(/undefined|\$\{|\{\{/);
      const values = SAMPLE[template] as Record<string, string>;
      for (const key of ["code", "link"]) {
        if (values[key]) expect(body).toContain(values[key]);
      }
    },
  );

  it("writes Arabic text for ar and Latin text for en", () => {
    for (const template of TEMPLATE_NAMES) {
      expect(render(template, "ar")).toMatch(/[؀-ۿ]/);
      expect(render(template, "en")).not.toMatch(/[؀-ۿ]/);
    }
  });

  it("shows times in the venue time zone (Cairo)", () => {
    // 16:20 UTC is 18:20 in Cairo in December (UTC+2).
    expect(render("booking-link", "en")).toContain("18:20");
    expect(render("booking-link", "ar")).toContain("18:20");
  });

  it("varies the staff alert by kind", () => {
    const urgent = render("staff-alert", "en", {
      ...SAMPLE["staff-alert"],
      kind: "urgent",
      depositEgp: undefined,
    });
    expect(urgent).toContain("Urgent");
    expect(urgent).not.toContain("EGP");
    expect(render("staff-alert", "en")).toContain("EGP 500");
    const arUrgent = render("staff-alert", "ar", {
      ...SAMPLE["staff-alert"],
      kind: "urgent",
    });
    expect(arUrgent).toContain("عاجل");
  });

  it("puts the booking and unsubscribe links in a slot alert", () => {
    const body = render("slot-alert", "en");
    expect(body).toContain(SAMPLE["slot-alert"].link);
    expect(body).toContain(SAMPLE["slot-alert"].unsubscribe);
    expect(body).toContain("18:30");
  });

  it("rejects values that do not fit the template", () => {
    expect(() =>
      render("code", "en", { code: "abc", minutes: "10" }),
    ).toThrow();
    expect(() =>
      render("booking-link", "en", { link: "not a url", deadlineAt: "x" }),
    ).toThrow();
  });
});
