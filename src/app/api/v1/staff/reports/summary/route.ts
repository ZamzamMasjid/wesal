import { route } from "@/api/http";
import { reportOperations } from "@/ops/reports/reports";

export const dynamic = "force-dynamic";

// Owner-only figures for a period (docs/features/booking-reports).
export const GET = route(reportOperations.summary);
