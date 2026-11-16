import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createCallContext } from "@/api/context";
import { DashboardShell } from "@/components/dashboard/shell";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { REQUEST_PATH_HEADER, safeNext } from "@/lib/safe-next";
import { staffOperations } from "@/ops/staff/staff";

import { currentCaller } from "../session";

export const dynamic = "force-dynamic";

export default async function ShellLayout({
  children,
  params,
}: LayoutProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Rendering the shell is not access: it only keeps a visitor without a
  // session out of the frame. Every API call behind it is checked on its own.
  const caller = await currentCaller();
  if (caller.kind !== "staff") {
    // Remember where they were going; login sends them back there.
    const next = safeNext((await headers()).get(REQUEST_PATH_HEADER));
    redirect({
      href: { pathname: "/dashboard/login", query: { next } },
      locale,
    });
  }
  const me = await staffOperations.me({}, createCallContext(caller));
  if (!me.ok) return redirect({ href: "/dashboard/login", locale });

  return (
    <DashboardShell user={{ name: me.data.name, role: me.data.role }}>
      {children}
    </DashboardShell>
  );
}
