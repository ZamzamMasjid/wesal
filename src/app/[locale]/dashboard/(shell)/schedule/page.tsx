import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import { currentCaller } from "../../session";
import { ScheduleManager } from "./schedule-manager";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
}: PageProps<"/[locale]/dashboard/schedule">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Only the owner edits the schedule; the API behind it refuses staff anyway.
  const caller = await currentCaller();
  if (caller.kind !== "staff" || caller.role !== "owner") {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("Dashboard.schedule");
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <ScheduleManager />
    </section>
  );
}
