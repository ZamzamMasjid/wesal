"use client";

import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  fetchMediaLibrary,
  fetchStaffContent,
  saveSiteContent,
  type DiskSpace,
  type MediaItem,
  type MediaLimits,
  type SiteTexts,
} from "@/lib/content-api";

import { MediaManager } from "./media-manager";

// The owner's content editor (docs/features/content-management design): the
// bilingual texts save explicitly through the sticky save bar; media changes
// take effect at once. Saving publishes, because v1 has no draft state.

type Loaded = {
  texts: SiteTexts;
  media: MediaItem[];
  limits: MediaLimits;
  disk: DiskSpace;
};

type Message = { ok: boolean; text: string } | null;

const EMPTY: SiteTexts = {
  descriptionAr: "",
  descriptionEn: "",
  policyAr: "",
  policyEn: "",
  contactPhone: "",
  contactWhatsapp: "",
};

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-focus";
const areaClass = inputClass + " min-h-32";

function sameTexts(a: SiteTexts, b: SiteTexts): boolean {
  return (
    a.descriptionAr === b.descriptionAr &&
    a.descriptionEn === b.descriptionEn &&
    a.policyAr === b.policyAr &&
    a.policyEn === b.policyEn &&
    a.contactPhone === b.contactPhone &&
    a.contactWhatsapp === b.contactWhatsapp
  );
}

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

export function ContentManager() {
  const t = useTranslations("Dashboard.content");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [texts, setTexts] = useState<SiteTexts>(EMPTY);
  const [savedTexts, setSavedTexts] = useState<SiteTexts>(EMPTY);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const dirty = loaded !== null && !sameTexts(texts, savedTexts);

  const load = useCallback(async () => {
    const [content, library] = await Promise.all([
      fetchStaffContent(),
      fetchMediaLibrary(),
    ]);
    if (!content.ok || !content.data || !library.ok || !library.data) {
      setLoadFailed(true);
      return;
    }
    setTexts(content.data.content);
    setSavedTexts(content.data.content);
    setLoaded({
      texts: content.data.content,
      media: library.data.media,
      limits: library.data.limits,
      disk: library.data.disk,
    });
    setLoadFailed(false);
  }, []);

  useEffect(() => {
    // Fetch on mount; the state updates when the responses arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers decide the wording; returning a value keeps older ones asking.
      event.returnValue = t("unsaved");
    };
    // In-app links do not fire beforeunload; ask before they navigate too.
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (
        anchor.target === "_blank" ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }
      if (!window.confirm(t("unsaved"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty, t]);

  async function reloadLibrary() {
    const result = await fetchMediaLibrary();
    if (result.ok && result.data) {
      setLoaded((current) =>
        current
          ? {
              ...current,
              media: result.data!.media,
              limits: result.data!.limits,
              disk: result.data!.disk,
            }
          : current,
      );
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const result = await saveSiteContent(texts);
    setSaving(false);
    if (result.ok && result.data) {
      setTexts(result.data.content);
      setSavedTexts(result.data.content);
      setLoaded((current) =>
        current ? { ...current, texts: result.data!.content } : current,
      );
      setMessage({ ok: true, text: t("saved") });
    } else if (result.error?.code === "VALIDATION_FAILED") {
      setMessage({ ok: false, text: t("invalid") });
    } else {
      setMessage({ ok: false, text: t("failed") });
    }
  }

  function field<K extends keyof SiteTexts>(key: K, value: SiteTexts[K]) {
    setTexts((current) => ({ ...current, [key]: value }));
  }

  if (loadFailed) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-sm bg-danger-soft p-3 text-danger">
          {t("loadFailed")}
        </p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!loaded) return <p className="text-muted">{t("loading")}</p>;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[60ch] text-muted">{t("intro")}</p>
        <a
          href={locale === "ar" ? "/" : "/en"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-(--size-touch-dense) items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium shadow-md hover:bg-fill"
        >
          <ExternalLink className="size-4" aria-hidden />
          {t("viewSite")}
        </a>
      </div>

      <Notice message={message} />

      <section className="space-y-4" aria-labelledby="content-texts-title">
        <h2 id="content-texts-title" className="text-2xl font-bold">
          {t("texts")}
        </h2>

        <fieldset className="grid gap-4 rounded-lg bg-surface p-4 shadow-md md:grid-cols-2">
          <legend className="sr-only">{t("texts")}</legend>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              {t("description")} — {t("arabic")}
            </span>
            <textarea
              dir="rtl"
              rows={6}
              maxLength={5000}
              value={texts.descriptionAr}
              onChange={(event) => field("descriptionAr", event.target.value)}
              className={areaClass}
            />
            <span className="block text-muted">{t("descriptionHint")}</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              {t("description")} — {t("english")}
            </span>
            <textarea
              dir="ltr"
              rows={6}
              maxLength={5000}
              value={texts.descriptionEn}
              onChange={(event) => field("descriptionEn", event.target.value)}
              className={areaClass}
            />
            {texts.descriptionEn.trim() === "" && (
              <span className="block text-muted">{t("sameAsArabic")}</span>
            )}
          </label>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg bg-surface p-4 shadow-md md:grid-cols-2">
          <legend className="sr-only">{t("policy")}</legend>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              {t("policy")} — {t("arabic")}
            </span>
            <textarea
              dir="rtl"
              rows={6}
              maxLength={5000}
              value={texts.policyAr}
              onChange={(event) => field("policyAr", event.target.value)}
              className={areaClass}
            />
            <span className="block text-muted">{t("policyHint")}</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">
              {t("policy")} — {t("english")}
            </span>
            <textarea
              dir="ltr"
              rows={6}
              maxLength={5000}
              value={texts.policyEn}
              onChange={(event) => field("policyEn", event.target.value)}
              className={areaClass}
            />
            {texts.policyEn.trim() === "" && (
              <span className="block text-muted">{t("sameAsArabic")}</span>
            )}
          </label>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg bg-surface p-4 shadow-md md:grid-cols-2">
          <legend className="text-lg font-bold">{t("contact")}</legend>
          <p className="text-sm text-muted md:col-span-2">{t("contactHint")}</p>
          <label className="space-y-1 text-sm">
            {t("phone")}
            <input
              type="tel"
              dir="ltr"
              maxLength={30}
              value={texts.contactPhone}
              onChange={(event) => field("contactPhone", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            {t("whatsapp")}
            <input
              type="tel"
              dir="ltr"
              maxLength={30}
              value={texts.contactWhatsapp}
              onChange={(event) => field("contactWhatsapp", event.target.value)}
              className={inputClass}
            />
          </label>
        </fieldset>
      </section>

      <MediaManager
        media={loaded.media}
        limits={loaded.limits}
        disk={loaded.disk}
        onReload={reloadLibrary}
      />

      {dirty && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface p-3 shadow-lg md:bottom-0 md:ps-(--size-sidenav)">
          <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-4">
            <p role="status" className="text-sm text-muted">
              {t("unsaved")}
            </p>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-full"
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
