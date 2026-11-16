import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeDirection, routing } from "@/i18n/routing";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

// Cairo carries Arabic and English (ADR-024). Bundled, so no third-party
// request; exposed as --font-sans, which the Tailwind theme reads.
const cairo = localFont({
  src: "../fonts/Cairo-Variable.ttf",
  variable: "--font-sans",
  weight: "200 1000",
  display: "swap",
  fallback: ["Segoe UI", "Tahoma", "system-ui", "sans-serif"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("title") };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Lets this layout and the pages below it render statically per locale.
  setRequestLocale(locale);

  return (
    // suppressHydrationWarning: the theme script below sets data-theme on <html>
    // before React hydrates, which the server HTML cannot know.
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={cairo.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
