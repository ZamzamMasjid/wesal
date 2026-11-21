import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { createCallContext } from "@/api/context";
import { MyNotifications } from "@/components/dashboard/notifications";
import { routing } from "@/i18n/routing";
import { staffOperations } from "@/ops/staff/staff";

import { currentCaller } from "../session";

export const dynamic = "force-dynamic";

export default async function DashboardHome({
  params,
}: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard");
  const me = await staffOperations.me(
    {},
    createCallContext(await currentCaller()),
  );
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          {t("welcome", { name: me.ok ? me.data.name : "" })}
        </h1>
        <p className="text-muted">{t("welcomeHint")}</p>
      </div>
      {me.ok && (
        <MyNotifications
          initial={{
            id: me.data.id,
            name: me.data.name,
            role: me.data.role,
            notifyPhone: me.data.notifyPhone,
            notifyEnabled: me.data.notifyEnabled,
            locale: me.data.locale,
          }}
        />
      )}
    </section>
  );
}
