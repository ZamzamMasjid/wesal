import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { routing } from "@/i18n/routing";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Home");

  return (
    <>
      {/* Placeholder header; the landing-page feature replaces it and adds
          "Find my booking" and the language switch to the same pill. */}
      <header className="mx-auto flex h-20 max-w-content items-center justify-between px-6">
        <span className="text-4xl leading-none font-bold text-brand">
          {t("heading")}
        </span>
        <nav className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-md">
          <ThemeToggle />
        </nav>
      </header>
      <main className="mx-auto max-w-content p-6">
        <h1 className="text-4xl font-bold">{t("heading")}</h1>
        <p className="text-muted">{t("tagline")}</p>
      </main>
    </>
  );
}
