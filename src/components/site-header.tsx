import { getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The public pages' chrome: the venue name linking home, the language switch and
// the theme toggle. One component so the calendar and the booking form cannot
// drift apart.

export async function SiteHeader({ locale }: { locale: "ar" | "en" }) {
  const t = await getTranslations("Calendar");
  const home = await getTranslations("Home");
  const other = routing.locales.find((l) => l !== locale) ?? locale;

  return (
    <header className="mx-auto flex h-20 max-w-content items-center justify-between px-6">
      <Link
        href="/"
        aria-label={t("homeLabel")}
        className="text-4xl leading-none font-bold text-brand"
      >
        {home("heading")}
      </Link>
      <nav
        aria-label={t("navLabel")}
        className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-md"
      >
        <Link
          href="/calendar"
          locale={other}
          className="flex h-(--size-touch-dense) items-center rounded-full px-3 text-sm font-medium hover:bg-fill"
        >
          {t("language")}
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
