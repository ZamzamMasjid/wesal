import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/auth/auth";

// Better Auth's login, logout and session routes (/api/auth/*). These sit
// outside /api/v1 because they are the identity provider, not Wesal operations.
// The instance is created per request so building the app needs no secrets.
export const dynamic = "force-dynamic";

export const GET = (request: Request) =>
  toNextJsHandler(getAuth()).GET(request);
export const POST = (request: Request) =>
  toNextJsHandler(getAuth()).POST(request);
