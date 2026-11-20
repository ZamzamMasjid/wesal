// Small pure pieces of the booking page's countdown (docs/design/views/
// booking-status.md). The countdown is measured from the server's deadline and
// the server's own `refreshedAt`, never from when the page loaded, so a wrong
// client clock cannot shorten or extend a hold (booking-page spec).

/** "17:42", "5:03", "1:02:03" — Latin digits in both languages. */
export function clockLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  }
  return `${minutes}:${seconds}`;
}

/** Which text warning the countdown carries; the color alone is never the signal. */
export type CountdownWarning = "under-five" | "under-one" | null;

export function countdownWarning(
  remainingSeconds: number,
  held: boolean,
): CountdownWarning {
  if (!held || remainingSeconds <= 0) return null;
  if (remainingSeconds < 60) return "under-one";
  if (remainingSeconds < 300) return "under-five";
  return null;
}

/**
 * Whether a tick should be announced: once a minute while more than ten seconds
 * remain, then every second of the last ten. The first value is not announced,
 * and zero is left to the assertive status change that follows it.
 */
export function shouldAnnounce(
  remainingSeconds: number,
  previousSeconds: number | null,
): boolean {
  if (previousSeconds === null) return false;
  if (remainingSeconds <= 0) return false;
  if (remainingSeconds <= 10) return remainingSeconds !== previousSeconds;
  return Math.ceil(remainingSeconds / 60) !== Math.ceil(previousSeconds / 60);
}
