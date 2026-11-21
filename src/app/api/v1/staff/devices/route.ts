import { route } from "@/api/http";
import { deviceOperations } from "@/ops/staff/devices";

export const dynamic = "force-dynamic";

// Registers this phone for staff push after login (docs/features/push-notifications).
export const POST = route(deviceOperations.register, { successStatus: 201 });
