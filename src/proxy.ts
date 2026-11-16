import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { REQUEST_PATH_HEADER, requestedPath } from "./lib/safe-next";

const handleLocale = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const response = handleLocale(request);

  // Tell server components which page was asked for, so a logged-out visitor
  // can be sent to login and then back (staff-access: deep links). Next reads
  // `x-middleware-request-*` response headers as extra request headers for the
  // render that follows; it only applies when the response is a rewrite or
  // pass-through, which is the only case that reaches a page.
  const overridden = response.headers.get("x-middleware-override-headers");
  if (overridden) {
    response.headers.set(
      "x-middleware-override-headers",
      `${overridden},${REQUEST_PATH_HEADER}`,
    );
    response.headers.set(
      `x-middleware-request-${REQUEST_PATH_HEADER}`,
      requestedPath(request.nextUrl.pathname, request.nextUrl.search),
    );
  }
  return response;
}

export const config = {
  // Everything except the JSON API (/api/v1 is not localized), Next internals
  // and files with an extension (fonts, images, favicon).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
