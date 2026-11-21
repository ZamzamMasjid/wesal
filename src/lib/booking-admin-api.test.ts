// SPEC: docs/features/booking-management — the bookings list is filtered by date, status, source and a search, and the filters live in the URL
// ROADMAP: phase-4-operations / booking-management / Implement bookings list API with filters by date, status and source
import { describe, expect, it } from "vitest";

import {
  filtersToQuery,
  parseFilters,
  BOOKINGS_PAGE_SIZE,
} from "./booking-admin-api";

describe("parseFilters", () => {
  it("keeps valid filters and normalises a blank page to the first one", () => {
    const filters = parseFilters({
      from: "2026-12-01",
      to: "2026-12-31",
      status: "confirmed",
      source: "staff",
      q: "  Mona  ",
      page: "2",
    });
    expect(filters).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
      status: "confirmed",
      source: "staff",
      q: "Mona",
      page: 2,
    });
  });

  it("drops unknown, malformed and out-of-range values instead of failing", () => {
    expect(
      parseFilters({
        from: "2026-02-31",
        to: "not-a-date",
        status: "lost",
        source: "walk-in",
        page: "0",
        q: "   ",
      }),
    ).toEqual({});

    expect(parseFilters({ page: "-3" })).toEqual({});
    expect(parseFilters({ page: "abc" })).toEqual({});
  });

  it("reads a URLSearchParams as well as page searchParams", () => {
    expect(parseFilters(new URLSearchParams("status=held&page=3"))).toEqual({
      status: "held",
      page: 3,
    });
  });

  it("drops array values, which a page can receive for a repeated key", () => {
    expect(
      parseFilters({ status: ["held", "confirmed"], q: ["a", "b"] }),
    ).toEqual({});
  });
});

describe("filtersToQuery", () => {
  it("writes only the set filters, trimming the search", () => {
    expect(
      filtersToQuery({
        from: "2026-12-01",
        status: "held",
        q: "  Mona ",
        page: 2,
      }),
    ).toBe("?from=2026-12-01&status=held&q=Mona&page=2");
  });

  it("drops page 1 and an empty search", () => {
    expect(filtersToQuery({ page: 1, q: "  " })).toBe("");
    expect(filtersToQuery({})).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const filters = { from: "2026-12-01", source: "online" as const, page: 4 };
    expect(parseFilters(new URLSearchParams(filtersToQuery(filters)))).toEqual(
      filters,
    );
  });
});

describe("page size", () => {
  it("matches the 25-per-page pattern", () => {
    expect(BOOKINGS_PAGE_SIZE).toBe(25);
  });
});
