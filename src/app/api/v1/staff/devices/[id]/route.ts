import { route } from "@/api/http";
import { deviceOperations } from "@/ops/staff/devices";

export const dynamic = "force-dynamic";

// Logout removes the device so it stops receiving that person's alerts.
export const DELETE = route(deviceOperations.unregister);
