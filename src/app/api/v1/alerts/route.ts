import { route } from "@/api/http";
import { alertOperations } from "@/ops/alerts/alerts";

export const dynamic = "force-dynamic";

// Watching a taken slot (docs/features/slot-alerts). A verified phone is the
// price of a subscription; nothing is reserved.
export const POST = route(alertOperations.create, { successStatus: 201 });
