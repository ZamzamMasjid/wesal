import { route } from "@/api/http";
import { bookingReadOperations } from "@/ops/booking/read";

export const dynamic = "force-dynamic";

// Turns a typed booking ID into the page's link. Rate-limited per IP and the
// same answer for a wrong ID as for one that never existed.
export const GET = route(bookingReadOperations.lookup);
