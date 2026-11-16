import { route } from "@/api/http";
import { scheduleOperations } from "@/ops/schedule/schedule";

export const dynamic = "force-dynamic";

export const GET = route(scheduleOperations.listExceptions);
