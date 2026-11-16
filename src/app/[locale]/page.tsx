import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Home");

  return (
    <main className="mx-auto max-w-content p-6">
      <h1 className="text-4xl font-bold">{t("heading")}</h1>
      <p className="text-muted">{t("tagline")}</p>
    </main>
  );
}
