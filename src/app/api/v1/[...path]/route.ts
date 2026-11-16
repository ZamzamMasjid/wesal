import { apiNotFound } from "@/api/http";

// Any /api/v1 path with no route of its own gets the JSON envelope, not an HTML
// 404 page.
export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
