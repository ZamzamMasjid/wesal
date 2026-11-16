import { route } from "@/api/http";
import { staffOperations } from "@/ops/staff/staff";

export const dynamic = "force-dynamic";

export const PATCH = route(staffOperations.updateUser);
