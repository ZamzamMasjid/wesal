// One HTTP Range header, parsed (RFC 9110 §14). Kept pure and separate from the
// route so the awkward cases — open-ended, suffix, past the end, several ranges
// — are tested without a file or a database.

export type RangeResult =
  | { type: "full" }
  | { type: "partial"; start: number; end: number }
  | { type: "unsatisfiable" };

/**
 * Reads the first range of the header against a known file size.
 *
 * - No header, a malformed header, a unit other than bytes, or several ranges
 *   falls back to the whole file. RFC 9110 allows a server to ignore Range, and
 *   a video player works correctly either way.
 * - A single range is clamped to the file. A start at or past the end is
 *   unsatisfiable, which the caller answers with 416 and `bytes * / size`.
 */
export function parseRange(header: string | null, size: number): RangeResult {
  if (!header) return { type: "full" };
  const match = /^bytes=(.+)$/i.exec(header.trim());
  if (!match) return { type: "full" };
  const parts = match[1]!.split(",");
  // Multiple ranges are legal but rare here; sending the whole file is simpler
  // and still a valid answer.
  if (parts.length !== 1) return { type: "full" };
  const value = parts[0]!.trim();
  const range = /^(\d*)-(\d*)$/.exec(value);
  if (!range) return { type: "full" };
  const [, rawStart, rawEnd] = range;

  if (rawStart === "" && rawEnd === "") return { type: "full" };
  if (size <= 0) return { type: "unsatisfiable" };

  if (rawStart === "") {
    // A suffix range: the last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return { type: "unsatisfiable" };
    }
    return {
      type: "partial",
      start: Math.max(0, size - suffix),
      end: size - 1,
    };
  }

  const start = Number(rawStart);
  if (!Number.isSafeInteger(start) || start >= size) {
    return { type: "unsatisfiable" };
  }
  const end = rawEnd === "" ? size - 1 : Number(rawEnd);
  if (!Number.isSafeInteger(end) || end < start) {
    return { type: "unsatisfiable" };
  }
  return { type: "partial", start, end: Math.min(end, size - 1) };
}

/** The `content-range` value for a partial answer. */
export function contentRange(start: number, end: number, size: number): string {
  return `bytes ${start}-${end}/${size}`;
}

/** The `content-range` value for a refused range. */
export function unsatisfiedRange(size: number): string {
  return `bytes */${size}`;
}
