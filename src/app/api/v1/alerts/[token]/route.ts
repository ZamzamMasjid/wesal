import { route } from "@/api/http";
import { alertOperations } from "@/ops/alerts/alerts";

export const dynamic = "force-dynamic";

// The unsubscribe link in a slot-alert message.
export const DELETE = route(alertOperations.unsubscribe);
