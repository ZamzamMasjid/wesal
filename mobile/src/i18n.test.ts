// SPEC: customer-mobile-app/spec.md — Arabic is the default language and every
// string has an English counterpart.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Scaffold Expo app with
// Arabic/English and RTL, consuming /api/v1

import { fill, strings, text } from "./i18n";

describe("text", () => {
  it("returns the catalogue for the chosen locale", () => {
    expect(text("ar").appName).toBe("وصال");
    expect(text("en").appName).toBe("Wesal");
    expect(text("en")).toBe(strings.en);
    expect(text("ar")).toBe(strings.ar);
  });

  it("keeps both catalogues in step for every key", () => {
    expect(Object.keys(strings.en).sort()).toEqual(
      Object.keys(strings.ar).sort(),
    );
  });
});

describe("fill", () => {
  it("replaces every placeholder", () => {
    expect(fill("{a} and {b} and {a}", { a: "one", b: "two" })).toBe(
      "one and two and one",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(fill("Time left: {time} ({zone})", { time: "02:00" })).toBe(
      "Time left: 02:00 ({zone})",
    );
  });
});
