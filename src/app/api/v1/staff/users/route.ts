import { route } from "@/api/http";
import { staffOperations } from "@/ops/staff/staff";

export const dynamic = "force-dynamic";

export const GET = route(staffOperations.listUsers);
export const POST = route(staffOperations.createUser, { successStatus: 201 });
