"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { unsubscribeSlotAlert } from "@/lib/alerts-api";

// The page behind the unsubscribe link in a slot-alert message. It asks once,
// then removes the subscription; the operation is idempotent, so a link opened
// twice is still a success.

type Phase = "ask" | "working" | "done" | "failed";

export function UnsubscribePanel({ token }: { token: string }) {
  const t = useTranslations("Alerts.unsubscribe");
  const [phase, setPhase] = useState<Phase>("ask");

  async function stop() {
    setPhase("working");
    const result = await unsubscribeSlotAlert(token);
    setPhase(result.ok ? "done" : "failed");
  }

  return (
    <section className="mx-auto max-w-[480px] rounded-lg bg-surface p-6 shadow-md">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {phase === "done" ? (
        <>
          <p role="status" className="mt-2 text-muted">
            {t("done")}
          </p>
          <Button asChild className="mt-5 h-(--size-touch) w-full rounded-full">
            <Link href="/calendar">{t("back")}</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted">{t("body")}</p>
          {phase === "failed" && (
            <p
              role="alert"
              className="mt-3 rounded-sm bg-danger-soft p-3 text-sm text-danger"
            >
              {t("failed")}
            </p>
          )}
          <Button
            type="button"
            className="mt-5 h-(--size-touch) w-full rounded-full"
            disabled={phase === "working"}
            onClick={() => void stop()}
          >
            {phase === "working" ? t("working") : t("confirm")}
          </Button>
        </>
      )}
    </section>
  );
}
