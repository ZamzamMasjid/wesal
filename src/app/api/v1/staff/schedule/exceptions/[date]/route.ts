import { route } from "@/api/http";
import { scheduleOperations } from "@/ops/schedule/schedule";

export const dynamic = "force-dynamic";

export const PUT = route(scheduleOperations.putException);
export const DELETE = route(scheduleOperations.deleteException);
