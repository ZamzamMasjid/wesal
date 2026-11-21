import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { createCallContext } from "@/api/context";
import { ReviewDetailView } from "@/components/review/review-detail";
import { ReviewQueue } from "@/components/review/review-queue";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { reviewOperations } from "@/ops/booking/review";

import { currentCaller } from "../../../session";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: PageProps<"/[locale]/dashboard/review/[bookingId]">) {
  const { locale, bookingId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.review");
  const ctx = createCallContext(await currentCaller());
  const [detail, queue] = await Promise.all([
    reviewOperations.get({ bookingId }, ctx),
    reviewOperations.queue({}, ctx),
  ]);

  if (!detail.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">
          {detail.error.code === "NOT_FOUND"
            ? t("errorNotFound")
            : t("loadFailed")}
        </p>
        <Link
          href="/dashboard/review"
          className="font-medium text-brand hover:underline"
        >
          {t("back")}
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
      <aside className="hidden md:block">
        <h1 className="mb-3 text-2xl font-bold">{t("queueTitle")}</h1>
        {queue.ok ? (
          <ReviewQueue initial={queue.data} />
        ) : (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">
            {t("loadFailed")}
          </p>
        )}
      </aside>
      <section className="min-w-0">
        <h1 className="mb-3 text-2xl font-bold md:sr-only">{t("title")}</h1>
        <ReviewDetailView initial={detail.data} />
      </section>
    </div>
  );
}
