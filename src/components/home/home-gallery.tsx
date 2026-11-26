"use client";

import { ChevronLeft, ChevronRight, Images, Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { MediaItem } from "@/lib/content-api";
import { mediaAlternative, type Locale } from "@/lib/site-text";

// The landing gallery and its lightbox (docs/design/views/home.md): a curated
// mosaic of the strongest tiles, with the remaining photos behind a count tile
// that opens the same lightbox. Tiles are buttons with the owner's alternative
// text; the lightbox traps focus, closes on Escape, and moves with arrows or the
// previous/next buttons. Videos never autoplay with sound and always have
// controls.

/** How many tiles the mosaic shows before the "+N photos" tile. */
export const FEATURED_COUNT = 7;

export function HomeGallery({
  media,
  locale,
  featuredCount = FEATURED_COUNT,
}: {
  media: MediaItem[];
  locale: Locale;
  /** Lets tests and future layouts change the mosaic cut without touching it. */
  featuredCount?: number;
}) {
  const t = useTranslations("Home");
  const headingId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const current = openIndex === null ? null : (media[openIndex] ?? null);

  const shown = media.slice(0, Math.max(0, featuredCount));
  const remaining = media.length - shown.length;
  const tiles = shown.length + (remaining > 0 ? 1 : 0);
  const morePreview = media[shown.length];

  function labelFor(item: MediaItem): string {
    const alt =
      mediaAlternative(item, locale) ||
      (item.kind === "video" ? t("videoAltFallback") : t("mediaAltFallback"));
    return item.kind === "video" ? `${t("video")}: ${alt}` : alt;
  }

  function step(delta: number) {
    setOpenIndex((index) => {
      if (index === null) return index;
      const next = index + delta;
      if (next < 0 || next >= media.length) return index;
      return next;
    });
  }

  // The mosaic: one large tile, four regular tiles, then a wide tile and two
  // regular ones. Small libraries stretch their last tile so a row never ends
  // with a hole. It falls back gracefully at every count.
  function spansWide(index: number): boolean {
    return (
      (tiles === 4 && index === 3) ||
      (tiles === 6 && index === 5) ||
      (tiles === 7 && index === 6) ||
      (tiles >= 8 && index === 5)
    );
  }

  function tileClass(index: number): string {
    if (tiles <= 2) return "col-span-2 md:col-span-4";
    if (index === 0) {
      return tiles >= 4 ? "col-span-2 md:row-span-2" : "col-span-2";
    }
    if (tiles === 6 && index === 5) return "col-span-2 md:col-span-4";
    if (spansWide(index)) return "col-span-2";
    return "";
  }

  function tileAspect(index: number): string {
    if (index === 0 || tiles <= 2 || spansWide(index)) {
      return "aspect-[16/9] md:aspect-auto";
    }
    return "aspect-[4/3] md:aspect-auto";
  }

  function tileSizes(index: number): string {
    if (index === 0 || tiles <= 2 || spansWide(index)) {
      return "(max-width: 768px) 100vw, 50vw";
    }
    return "(max-width: 768px) 50vw, 25vw";
  }

  return (
    <section className="pt-16 md:pt-24" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-3xl font-bold md:text-5xl">
        {t("gallery")}
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-3 md:auto-rows-[190px] md:grid-cols-4 md:gap-4 lg:auto-rows-[220px]">
        {shown.map((item, index) => (
          <li
            key={item.id}
            className={`${tileClass(index)} ${tileAspect(index)} min-w-0`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={labelFor(item)}
              className="group relative block h-full w-full overflow-hidden rounded-lg bg-fill focus-visible:ring-2 focus-visible:ring-focus"
            >
              {item.kind === "photo" ? (
                <Image
                  src={item.url}
                  alt=""
                  fill
                  unoptimized
                  sizes={tileSizes(index)}
                  className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                />
              ) : (
                <>
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    tabIndex={-1}
                    className="size-full object-cover"
                  />
                  <span className="absolute bottom-3 start-3 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm font-medium shadow-sm">
                    <Play aria-hidden="true" className="size-4 fill-current" />
                    {t("video")}
                  </span>
                </>
              )}
            </button>
          </li>
        ))}

        {remaining > 0 && (
          <li
            className={`${tileClass(shown.length)} ${tileAspect(shown.length)} min-w-0`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(shown.length)}
              aria-label={`+${remaining} ${t("morePhotos")} — ${t("showAll", { count: media.length })}`}
              className="group relative block h-full w-full overflow-hidden rounded-lg bg-fill focus-visible:ring-2 focus-visible:ring-focus"
            >
              {morePreview?.kind === "photo" && (
                <Image
                  src={morePreview.url}
                  alt=""
                  fill
                  unoptimized
                  sizes={tileSizes(shown.length)}
                  className="object-cover opacity-70 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                />
              )}
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-photo-scrim/45"
              />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-photo-fg">
                <Images
                  aria-hidden="true"
                  className="size-6"
                  strokeWidth={1.75}
                />
                <bdi dir="ltr" className="text-2xl font-bold tabular-nums">
                  +{remaining}
                </bdi>{" "}
                <span className="text-sm font-medium">{t("morePhotos")}</span>
              </span>
            </button>
          </li>
        )}
      </ul>

      <Dialog
        open={openIndex !== null}
        onOpenChange={(open) => {
          if (!open) setOpenIndex(null);
        }}
      >
        {current && (
          <DialogContent
            closeLabel={t("close")}
            className="w-[min(96vw,64rem)] max-w-none p-3 sm:p-4"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                step(1);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                step(-1);
              }
            }}
          >
            <DialogTitle className="sr-only">{t("lightbox")}</DialogTitle>
            {current.kind === "video" ? (
              <video
                key={current.id}
                src={current.url}
                controls
                muted
                autoPlay
                playsInline
                aria-label={labelFor(current)}
                className="mx-auto max-h-[75vh] w-full rounded-md bg-black"
              />
            ) : (
              <Image
                key={current.id}
                src={current.url}
                alt={labelFor(current)}
                width={1600}
                height={1000}
                unoptimized
                className="mx-auto max-h-[75vh] w-auto rounded-md object-contain"
              />
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={(openIndex ?? 0) === 0}
                className="inline-flex min-h-(--size-touch-dense) items-center gap-1 rounded-full bg-fill px-4 text-sm font-medium disabled:opacity-40"
              >
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 rtl:hidden"
                />
                <ChevronLeft
                  aria-hidden="true"
                  className="hidden size-4 rtl:block"
                />
                {t("previous")}
              </button>
              <span dir="ltr" className="text-sm tabular-nums text-muted">
                {(openIndex ?? 0) + 1} / {media.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={(openIndex ?? 0) === media.length - 1}
                className="inline-flex min-h-(--size-touch-dense) items-center gap-1 rounded-full bg-fill px-4 text-sm font-medium disabled:opacity-40"
              >
                {t("next")}
                <ChevronLeft aria-hidden="true" className="size-4 rtl:hidden" />
                <ChevronRight
                  aria-hidden="true"
                  className="hidden size-4 rtl:block"
                />
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
