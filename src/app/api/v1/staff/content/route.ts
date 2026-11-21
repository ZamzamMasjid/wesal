import { route } from "@/api/http";
import { contentOperations } from "@/ops/content/content";

export const dynamic = "force-dynamic";

export const GET = route(contentOperations.staffGet);
export const PUT = route(contentOperations.update);
