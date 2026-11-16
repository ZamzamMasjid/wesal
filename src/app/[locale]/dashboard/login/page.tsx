import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { safeNext } from "@/lib/safe-next";

import { currentCaller } from "../session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/login">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const requested = (await searchParams).next;
  const next = safeNext(typeof requested === "string" ? requested : undefined);
  if ((await currentCaller()).kind === "staff") {
    redirect({ href: next, locale });
  }

  const t = await getTranslations("Login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-brand">{t("title")}</h1>
        <ThemeToggle />
      </div>
      <LoginForm next={next} />
    </main>
  );
}
