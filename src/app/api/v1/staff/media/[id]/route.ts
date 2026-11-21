import { route } from "@/api/http";
import { mediaOperations } from "@/ops/content/media";

export const dynamic = "force-dynamic";

export const PATCH = route(mediaOperations.update);
export const DELETE = route(mediaOperations.remove);
