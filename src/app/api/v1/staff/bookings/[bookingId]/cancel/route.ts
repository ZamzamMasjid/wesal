import { route } from "@/api/http";
import { adminBookingOperations } from "@/ops/booking/admin";

export const dynamic = "force-dynamic";

export const POST = route(adminBookingOperations.cancel);
