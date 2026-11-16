import { route } from "@/api/http";
import { settingsOperations } from "@/ops/venue/settings";

export const dynamic = "force-dynamic";

export const GET = route(settingsOperations.get);
export const PUT = route(settingsOperations.put);
