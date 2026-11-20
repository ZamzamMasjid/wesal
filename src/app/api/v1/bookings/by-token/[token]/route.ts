import { route } from "@/api/http";
import { bookingReadOperations } from "@/ops/booking/read";

export const dynamic = "force-dynamic";

// The private booking page's data. The link token in the path is the holder's
// key (docs/architecture/auth.md); anyone holding it sees this one booking.
export const GET = route(bookingReadOperations.byToken);
