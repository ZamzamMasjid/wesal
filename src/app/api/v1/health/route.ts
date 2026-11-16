import { route } from "@/api/http";
import { getHealth } from "@/ops/health";

export const dynamic = "force-dynamic";

export const GET = route(getHealth);
