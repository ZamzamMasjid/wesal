import { getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The public pages' chrome: the venue name linking home, the language switch and
// the theme toggle. One component so the public pages cannot drift apart. The
// landing page also asks for the booking lookup link; the calendar does not.

export async function SiteHeader({
  locale,
  path = "/calendar",
  findBooking = false,
}: {
  locale: "ar" | "en";
  /** The page the language switch reloads, so the visitor stays where they are. */
  path?: "/" | "/calendar";
  /** Show the "Find my booking" link in the same pill. */
  findBooking?: boolean;
}) {
  const t = await getTranslations("Calendar");
  const home = await getTranslations("Home");
  const other = routing.locales.find((l) => l !== locale) ?? locale;

  return (
    <header className="mx-auto flex h-20 max-w-content items-center justify-between gap-2 px-4 md:px-6">
      <Link
        href="/"
        aria-label={t("homeLabel")}
        className="text-3xl leading-none font-bold text-brand md:text-4xl"
      >
        {home("heading")}
      </Link>
      <nav
        aria-label={t("navLabel")}
        className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-md"
      >
        {findBooking && (
          <Link
            href="/find-booking"
            className="flex h-(--size-touch-dense) items-center rounded-full px-3 text-sm font-medium hover:bg-fill"
          >
            {home("findBooking")}
          </Link>
        )}
        <Link
          href={path}
          locale={other}
          hrefLang={other}
          lang={other}
          className="flex h-(--size-touch-dense) items-center rounded-full px-3 text-sm font-medium hover:bg-fill"
        >
          {t("language")}
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
