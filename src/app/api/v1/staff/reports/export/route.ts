import { fileRoute } from "@/api/http";
import { reportOperations } from "@/ops/reports/reports";

export const dynamic = "force-dynamic";

// The period's figures as a CSV download; owner only.
export const GET = fileRoute(reportOperations.exportReport);
