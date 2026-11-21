import { mediaRoute } from "@/api/http";
import { mediaOperations } from "@/ops/content/media";

export const dynamic = "force-dynamic";

export const GET = mediaRoute(mediaOperations.read);
