import { route } from "@/api/http";
import { mediaOperations } from "@/ops/content/media";

export const dynamic = "force-dynamic";

/** Multipart input: the wrapper only reads the form; the operation validates it. */
async function uploadInput(request: Request) {
  const form = await request.formData();
  return {
    file: form.get("file"),
    altAr: form.get("altAr") ?? "",
    altEn: form.get("altEn") ?? "",
  };
}

export const GET = route(mediaOperations.list);
export const POST = route(mediaOperations.upload, {
  input: uploadInput,
  successStatus: 201,
});
