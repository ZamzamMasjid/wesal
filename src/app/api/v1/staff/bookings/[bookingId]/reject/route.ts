import { route } from "@/api/http";
import { reviewOperations } from "@/ops/booking/review";

export const dynamic = "force-dynamic";

export const POST = route(reviewOperations.reject);
