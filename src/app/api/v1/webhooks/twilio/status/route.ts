import { route } from "@/api/http";
import { readFormParams } from "@/ops/messaging/form-params";
import { twilioStatusOperation } from "@/ops/messaging/twilio-status";

export const dynamic = "force-dynamic";

// Twilio posts application/x-www-form-urlencoded; the signature is a header.
export const POST = route(twilioStatusOperation, {
  input: async (request) => ({
    signature: request.headers.get("x-twilio-signature"),
    params: await readFormParams(request),
  }),
});
