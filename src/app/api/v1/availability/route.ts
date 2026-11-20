import { route } from "@/api/http";
import { calendarOperations } from "@/ops/calendar/availability";

export const dynamic = "force-dynamic";

// Public slot states. A few seconds of shared caching is allowed (ADR-014):
// the hold endpoint is what actually prevents a double booking.
export const GET = route(calendarOperations.availability, {
  cacheControl: "public, max-age=5",
});
