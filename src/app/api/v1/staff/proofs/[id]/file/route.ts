import { fileRoute } from "@/api/http";
import { proofOperations } from "@/ops/booking/proof";

export const dynamic = "force-dynamic";

// A payment screenshot, served only to a logged-in staff session (ADR-013). It
// has no public address and is never attached to a message.
export const GET = fileRoute(proofOperations.staffFile);
