import { route } from "@/api/http";
import { occasionOperations } from "@/ops/venue/occasions";

export const dynamic = "force-dynamic";

export const GET = route(occasionOperations.listPublic);
