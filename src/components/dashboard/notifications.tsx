"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { ApiEnvelope } from "@/lib/api-envelope";

// The staff member's own alert settings (docs/features/staff-notifications):
// the phone alerts go to, whether they are on, and the language they are written
// in. Alerts go through the outbox, so this only decides who is told and how.

export interface StaffProfile {
  id: string;
  name: string;
  role: "owner" | "staff";
  notifyPhone: string | null;
  notifyEnabled: boolean;
  locale: "ar" | "en";
}

const inputClass =
  "h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus";

export function MyNotifications({ initial }: { initial: StaffProfile }) {
  const t = useTranslations("Dashboard.notifications");
  const [phone, setPhone] = useState(initial.notifyPhone ?? "");
  const [enabled, setEnabled] = useState(initial.notifyEnabled);
  const [locale, setLocale] = useState(initial.locale);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    let result: ApiEnvelope<StaffProfile>;
    try {
      const response = await fetch("/api/v1/staff/me/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          notifyPhone: phone.trim() === "" ? null : phone.trim(),
          notifyEnabled: enabled,
          locale,
        }),
      });
      result = (await response.json()) as ApiEnvelope<StaffProfile>;
    } catch {
      result = { ok: false, error: { code: "NETWORK" } };
    }
    setSaving(false);
    if (result.ok && result.data) {
      setPhone(result.data.notifyPhone ?? "");
      setEnabled(result.data.notifyEnabled);
      setLocale(result.data.locale);
      setMessage({ ok: true, text: t("saved") });
    } else {
      setMessage({
        ok: false,
        text:
          result.error?.code === "VALIDATION_FAILED"
            ? t("invalid")
            : t("failed"),
      });
    }
  }

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-lg bg-surface p-4 shadow-md"
    >
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="text-sm text-muted">{t("hint")}</p>

      {initial.role === "owner" && !phone.trim() && (
        <p role="status" className="rounded-sm bg-warning-soft p-3 text-sm">
          {t("ownerPhoneWarning")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          {t("phone")}
          <input
            type="tel"
            dir="ltr"
            value={phone}
            autoComplete="tel"
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          {t("language")}
          <select
            value={locale}
            onChange={(event) =>
              setLocale(event.target.value === "en" ? "en" : "ar")
            }
            className={inputClass}
          >
            <option value="ar">{t("languageAr")}</option>
            <option value="en">{t("languageEn")}</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {t("enabled")}
      </label>
      <p className="text-sm text-muted">{t("phoneHint")}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={saving}
          className="h-(--size-touch-dense) rounded-full"
        >
          {saving ? t("saving") : t("save")}
        </Button>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={
              "rounded-sm px-3 py-2 text-sm " +
              (message.ok
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger")
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
