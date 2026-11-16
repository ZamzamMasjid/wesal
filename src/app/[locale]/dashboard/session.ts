import { headers } from "next/headers";

import { resolveCaller, type Caller } from "@/api/caller";

/** The signed-in staff caller for this server render, or anonymous. */
export async function currentCaller(): Promise<Caller> {
  const h = await headers();
  return resolveCaller(new Request("http://internal.invalid/", { headers: h }));
}
