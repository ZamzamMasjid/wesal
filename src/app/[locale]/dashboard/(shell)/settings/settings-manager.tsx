"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

interface Occasion {
  id: number;
  nameAr: string;
  nameEn: string;
  priceEgp: number;
  active: boolean;
}

interface VenueSettings {
  depositPercent: number;
  holdMinutes: number;
  nearSlotCutoffMinutes: number;
  urgentThresholdMinutes: number;
  maxPhotoMb: number;
  maxVideoMb: number;
  vodafoneCashNumber: string | null;
  instapayAddress: string | null;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string };
}

async function call<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<Envelope<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await response.json()) as Envelope<T>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

const inputClass =
  "h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus";
const cardClass = "space-y-3 rounded-lg bg-surface p-4 shadow-md";

/** An empty field is not a number: Number("") is 0, which would pass as a price. */
function num(value: FormDataEntryValue | null): number {
  const text = String(value ?? "").trim();
  return text === "" ? Number.NaN : Number(text);
}

type Message = { ok: boolean; text: string } | null;

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className={
        "rounded-sm p-3 text-sm " +
        (message.ok
          ? "bg-success-soft text-success"
          : "bg-danger-soft text-danger")
      }
    >
      {message.text}
    </p>
  );
}

/** The owner's venue settings: occasions and prices, deposit and rules, payment details. */
export function SettingsManager() {
  const t = useTranslations("Dashboard.settings");
  const locale = useLocale();
  const [occasions, setOccasions] = useState<Occasion[] | null>(null);
  const [settings, setSettings] = useState<VenueSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [occasionMessage, setOccasionMessage] = useState<Message>(null);
  const [settingsMessage, setSettingsMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([
      call<{ occasions: Occasion[] }>("/api/v1/staff/occasions", "GET"),
      call<VenueSettings>("/api/v1/staff/settings", "GET"),
    ]);
    if (o.ok && o.data && s.ok && s.data) {
      setOccasions(o.data.occasions);
      setSettings(s.data);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount; the state update happens when the response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function errorText(code: string | undefined): string {
    if (code === "VALIDATION_FAILED") return t("invalid");
    return t("failed");
  }

  async function onAddOccasion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setOccasionMessage(null);
    const result = await call("/api/v1/staff/occasions", "POST", {
      nameAr: String(data.get("nameAr") ?? ""),
      nameEn: String(data.get("nameEn") ?? ""),
      priceEgp: num(data.get("priceEgp")),
    });
    setBusy(false);
    if (result.ok) {
      form.reset();
      setOccasionMessage({ ok: true, text: t("occasionSaved") });
      await load();
    } else {
      setOccasionMessage({ ok: false, text: errorText(result.error?.code) });
    }
  }

  async function onSaveOccasion(
    event: FormEvent<HTMLFormElement>,
    occasion: Occasion,
  ) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setOccasionMessage(null);
    const result = await call(
      `/api/v1/staff/occasions/${occasion.id}`,
      "PATCH",
      {
        nameAr: String(data.get("nameAr") ?? ""),
        nameEn: String(data.get("nameEn") ?? ""),
        priceEgp: num(data.get("priceEgp")),
      },
    );
    setBusy(false);
    setOccasionMessage(
      result.ok
        ? { ok: true, text: t("occasionSaved") }
        : { ok: false, text: errorText(result.error?.code) },
    );
    await load();
  }

  async function setOccasionActive(occasion: Occasion, active: boolean) {
    if (
      !active &&
      !window.confirm(t("confirmDeactivate", { name: occasion.nameEn }))
    ) {
      return;
    }
    setOccasionMessage(null);
    const result = await call(
      `/api/v1/staff/occasions/${occasion.id}`,
      "PATCH",
      { active },
    );
    if (!result.ok) {
      setOccasionMessage({ ok: false, text: errorText(result.error?.code) });
    }
    await load();
  }

  async function onSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !settings) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    setBusy(true);
    setSettingsMessage(null);
    const result = await call<VenueSettings>("/api/v1/staff/settings", "PUT", {
      depositPercent: num(data.get("depositPercent")),
      holdMinutes: num(data.get("holdMinutes")),
      nearSlotCutoffMinutes: num(data.get("nearSlotCutoffMinutes")),
      urgentThresholdMinutes: num(data.get("urgentThresholdMinutes")),
      maxPhotoMb: num(data.get("maxPhotoMb")),
      maxVideoMb: num(data.get("maxVideoMb")),
      vodafoneCashNumber: text("vodafoneCashNumber") || null,
      instapayAddress: text("instapayAddress") || null,
    });
    setBusy(false);
    if (result.ok && result.data) {
      setSettings(result.data);
      setSettingsMessage({ ok: true, text: t("settingsSaved") });
    } else {
      setSettingsMessage({ ok: false, text: errorText(result.error?.code) });
    }
  }

  if (loadFailed) {
    return (
      <p role="alert" className="rounded-sm bg-danger-soft p-3 text-danger">
        {t("loadFailed")}
      </p>
    );
  }
  if (!occasions || !settings)
    return <p className="text-muted">{t("loading")}</p>;

  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
  const noPayment = !settings.vodafoneCashNumber && !settings.instapayAddress;

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="occasions-title">
        <h2 id="occasions-title" className="text-2xl font-bold">
          {t("occasions")}
        </h2>
        <p className="text-sm text-muted">{t("occasionsHint")}</p>
        <Notice message={occasionMessage} />
        <ul className="space-y-3">
          {occasions.map((o) => (
            <li key={o.id} className={cardClass}>
              <form
                noValidate
                onSubmit={(e) => onSaveOccasion(e, o)}
                className="grid gap-3 sm:grid-cols-3"
              >
                <label className="space-y-1 text-sm">
                  {t("nameAr")}
                  <input
                    name="nameAr"
                    dir="rtl"
                    required
                    defaultValue={o.nameAr}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  {t("nameEn")}
                  <input
                    name="nameEn"
                    dir="ltr"
                    required
                    defaultValue={o.nameEn}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  {t("price")}
                  <input
                    name="priceEgp"
                    type="number"
                    dir="ltr"
                    min={0}
                    step={1}
                    required
                    defaultValue={o.priceEgp}
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                  <span className="text-sm text-muted">
                    {o.active
                      ? t("offered", { price: price.format(o.priceEgp) })
                      : t("notOffered")}
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy}
                    className="ms-auto rounded-full"
                  >
                    {t("save")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setOccasionActive(o, !o.active)}
                  >
                    {o.active ? t("deactivate") : t("activate")}
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
        <form
          noValidate
          onSubmit={onAddOccasion}
          className={"grid gap-3 sm:grid-cols-3 " + cardClass}
        >
          <h3 className="text-xl font-bold sm:col-span-3">
            {t("addOccasion")}
          </h3>
          <label className="space-y-1 text-sm">
            {t("nameAr")}
            <input name="nameAr" dir="rtl" required className={inputClass} />
          </label>
          <label className="space-y-1 text-sm">
            {t("nameEn")}
            <input name="nameEn" dir="ltr" required className={inputClass} />
          </label>
          <label className="space-y-1 text-sm">
            {t("price")}
            <input
              name="priceEgp"
              type="number"
              dir="ltr"
              min={0}
              step={1}
              required
              className={inputClass}
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            className="h-(--size-touch-dense) rounded-full sm:col-span-3"
          >
            {t("add")}
          </Button>
        </form>
      </section>

      <form
        key={JSON.stringify(settings)}
        noValidate
        onSubmit={onSaveSettings}
        className="space-y-4"
        aria-labelledby="rules-title"
      >
        <h2 id="rules-title" className="text-2xl font-bold">
          {t("rules")}
        </h2>
        <Notice message={settingsMessage} />
        <div className={"grid gap-3 sm:grid-cols-2 " + cardClass}>
          <label className="space-y-1 text-sm">
            {t("depositPercent")}
            <input
              name="depositPercent"
              type="number"
              dir="ltr"
              min={1}
              max={100}
              step={1}
              required
              defaultValue={settings.depositPercent}
              className={inputClass}
            />
            <span className="block text-muted">{t("depositHint")}</span>
          </label>
          <label className="space-y-1 text-sm">
            {t("holdMinutes")}
            <input
              name="holdMinutes"
              type="number"
              dir="ltr"
              min={1}
              max={1440}
              step={1}
              required
              defaultValue={settings.holdMinutes}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            {t("nearSlotCutoffMinutes")}
            <input
              name="nearSlotCutoffMinutes"
              type="number"
              dir="ltr"
              min={0}
              step={1}
              required
              defaultValue={settings.nearSlotCutoffMinutes}
              className={inputClass}
            />
            <span className="block text-muted">{t("cutoffHint")}</span>
          </label>
          <label className="space-y-1 text-sm">
            {t("urgentThresholdMinutes")}
            <input
              name="urgentThresholdMinutes"
              type="number"
              dir="ltr"
              min={0}
              step={1}
              required
              defaultValue={settings.urgentThresholdMinutes}
              className={inputClass}
            />
            <span className="block text-muted">{t("urgentHint")}</span>
          </label>
          <label className="space-y-1 text-sm">
            {t("maxPhotoMb")}
            <input
              name="maxPhotoMb"
              type="number"
              dir="ltr"
              min={1}
              step={1}
              required
              defaultValue={settings.maxPhotoMb}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            {t("maxVideoMb")}
            <input
              name="maxVideoMb"
              type="number"
              dir="ltr"
              min={1}
              step={1}
              required
              defaultValue={settings.maxVideoMb}
              className={inputClass}
            />
            <span className="block text-muted">{t("mediaHint")}</span>
          </label>
        </div>

        <h2 className="text-2xl font-bold">{t("payment")}</h2>
        <div className={"grid gap-3 sm:grid-cols-2 " + cardClass}>
          {noPayment && (
            <p
              role="status"
              className="rounded-sm bg-warning-soft p-3 text-sm text-warning sm:col-span-2"
            >
              {t("noPayment")}
            </p>
          )}
          <label className="space-y-1 text-sm">
            {t("vodafoneCash")}
            <input
              name="vodafoneCashNumber"
              type="tel"
              dir="ltr"
              defaultValue={settings.vodafoneCashNumber ?? ""}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            {t("instapay")}
            <input
              name="instapayAddress"
              dir="ltr"
              autoCapitalize="none"
              defaultValue={settings.instapayAddress ?? ""}
              className={inputClass}
            />
          </label>
          <p className="text-sm text-muted sm:col-span-2">
            {t("paymentWarning")}
          </p>
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="h-(--size-touch-dense) rounded-full"
        >
          {busy ? t("saving") : t("saveSettings")}
        </Button>
      </form>
    </div>
  );
}
