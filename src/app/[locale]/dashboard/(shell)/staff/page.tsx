import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import { currentCaller } from "../../session";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  params,
}: PageProps<"/[locale]/dashboard/staff">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // The page is hidden from staff, and the API behind it refuses them anyway.
  const caller = await currentCaller();
  if (caller.kind !== "staff" || caller.role !== "owner") {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("Dashboard.staff");
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <StaffManager />
    </section>
  );
}
