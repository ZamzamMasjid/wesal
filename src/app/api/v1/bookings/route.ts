import { route } from "@/api/http";
import { bookingOperations } from "@/ops/booking/hold";

export const dynamic = "force-dynamic";

// Creates a 20-minute hold. The verified-phone token in the body is the proof
// that the caller controls the number; the database decides a race.
export const POST = route(bookingOperations.create, { successStatus: 201 });
