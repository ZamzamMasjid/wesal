import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { createCallContext } from "@/api/context";
import { ReviewQueue } from "@/components/review/review-queue";
import { routing } from "@/i18n/routing";
import { reviewOperations } from "@/ops/booking/review";

import { currentCaller } from "../../session";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({
  params,
}: PageProps<"/[locale]/dashboard/review">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.review");
  const result = await reviewOperations.queue(
    {},
    createCallContext(await currentCaller()),
  );

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      {result.ok ? (
        <ReviewQueue initial={result.data} />
      ) : (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">
          {t("loadFailed")}
        </p>
      )}
    </section>
  );
}
