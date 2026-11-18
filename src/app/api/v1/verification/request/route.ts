import { route } from "@/api/http";
import { verificationOperations } from "@/ops/verification/verification";

export const dynamic = "force-dynamic";

export const POST = route(verificationOperations.request);
