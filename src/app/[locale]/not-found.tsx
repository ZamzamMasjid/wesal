import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="mx-auto max-w-content space-y-4 p-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      <Link href="/" className="text-brand underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
