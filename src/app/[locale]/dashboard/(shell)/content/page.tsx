import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ContentManager } from "@/components/content/content-manager";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import { currentCaller } from "../../session";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  params,
}: PageProps<"/[locale]/dashboard/content">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Hidden from staff; the API behind it refuses them anyway.
  const caller = await currentCaller();
  if (caller.kind !== "staff" || caller.role !== "owner") {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("Dashboard.content");
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <ContentManager />
    </section>
  );
}
