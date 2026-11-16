import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleLocale = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return handleLocale(request);
}

export const config = {
  // Everything except the JSON API (/api/v1 is not localized), Next internals
  // and files with an extension (fonts, images, favicon).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
