import { getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { WesalMark } from "@/components/wesal-mark";
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
    <header className="mx-auto flex h-20 w-full max-w-content items-center justify-between gap-2 px-4 md:px-6">
      <Link
        href="/"
        aria-label={t("homeLabel")}
        className="inline-flex items-center gap-1.5 rounded-full bg-logo-bg px-3 py-1.5 text-logo-fg shadow-md ring-1 ring-logo-fg/15 md:gap-2 md:px-4 md:py-2"
      >
        <WesalMark className="size-6 shrink-0 md:size-7" />
        <span className="text-xl leading-none font-bold md:text-3xl">
          {home("heading")}
        </span>
      </Link>
      <nav
        aria-label={t("navLabel")}
        className="flex items-center gap-1 rounded-full bg-surface p-1 text-fg shadow-md"
      >
        {findBooking && (
          <Link
            href="/find-booking"
            className="flex h-(--size-touch-dense) items-center rounded-full px-2 text-sm font-medium whitespace-nowrap hover:bg-fill md:px-3"
          >
            {home("findBooking")}
          </Link>
        )}
        <Link
          href={path}
          locale={other}
          hrefLang={other}
          lang={other}
          className="flex h-(--size-touch-dense) items-center rounded-full px-2 text-sm font-medium whitespace-nowrap hover:bg-fill md:px-3"
        >
          {t("language")}
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
