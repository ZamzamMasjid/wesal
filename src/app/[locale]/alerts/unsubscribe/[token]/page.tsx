import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { UnsubscribePanel } from "@/components/alerts/unsubscribe-panel";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: PageProps<"/[locale]/alerts/unsubscribe/[token]">) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-content px-6 py-10">
        <UnsubscribePanel token={token} />
      </main>
    </>
  );
}
