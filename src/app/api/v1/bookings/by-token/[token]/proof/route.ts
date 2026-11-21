import { ApiError } from "@/api/errors";
import { route } from "@/api/http";
import { proofOperations } from "@/ops/booking/proof";

export const dynamic = "force-dynamic";

// The transfer screenshot upload (docs/features/payment-proof). The link token
// in the path is the holder's key; the image is checked from its content, never
// from its name. A multipart body is read here because the default route input
// only understands JSON and query strings.

export const POST = route(proofOperations.upload, {
  successStatus: 201,
  input: async (request, params) => {
    const token = params.token;
    if (typeof token !== "string") {
      throw new ApiError("NOT_FOUND", "No booking with that link.");
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new ApiError(
        "INVALID_FILE",
        "Send the screenshot as a file upload.",
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError("INVALID_FILE", "The upload could not be read.");
    }
    return { token, file: form.get("file") };
  },
});
