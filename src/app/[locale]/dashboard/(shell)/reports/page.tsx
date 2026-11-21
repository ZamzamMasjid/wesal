import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { createCallContext } from "@/api/context";
import { ReportsView } from "@/components/reports/reports-view";
import { routing } from "@/i18n/routing";
import { cairoDay } from "@/lib/cairo-time";
import { firstDayOfMonth, lastDayOfMonth, monthOf } from "@/lib/calendar-grid";
import { reportOperations } from "@/ops/reports/reports";

import { currentCaller } from "../../session";

// Owner reports (docs/features/booking-reports). The current month is rendered
// on the server through the same operation the API exposes (ADR-020); the client
// half reloads every figure when the period changes. Staff cannot read reports,
// and the operation enforces that whatever this page does.

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
}: PageProps<"/[locale]/dashboard/reports">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.reports");
  const ctx = createCallContext(await currentCaller());
  const month = monthOf(cairoDay(ctx.clock.now()));
  const period = { kind: "month" as const, month };
  const result = await reportOperations.summary(
    { from: firstDayOfMonth(month), to: lastDayOfMonth(month) },
    ctx,
  );

  if (!result.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">
          {result.error.code === "FORBIDDEN"
            ? t("ownerOnly")
            : t("loadFailed")}
        </p>
      </section>
    );
  }

  return <ReportsView initial={result.data} initialPeriod={period} />;
}
