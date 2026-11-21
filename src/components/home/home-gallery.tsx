"use client";

import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { MediaItem } from "@/lib/content-api";
import { mediaAlternative, type Locale } from "@/lib/site-text";

// The landing gallery and its lightbox (docs/design/views/home.md): a photo and
// video grid whose first tile is double width. Tiles are buttons with the
// owner's alternative text; the lightbox traps focus, closes on Escape, and
// moves with arrows or the previous/next buttons. Videos never autoplay with
// sound and always have controls.

export function HomeGallery({
  media,
  locale,
}: {
  media: MediaItem[];
  locale: Locale;
}) {
  const t = useTranslations("Home");
  const headingId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const current = openIndex === null ? null : (media[openIndex] ?? null);

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

  return (
    <section className="pt-16 md:pt-24" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-3xl font-bold md:text-5xl">
        {t("gallery")}
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {media.map((item, index) => (
          <li key={item.id} className={index === 0 ? "col-span-2" : undefined}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={labelFor(item)}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-fill focus-visible:ring-2 focus-visible:ring-focus"
            >
              {item.kind === "photo" ? (
                <Image
                  src={item.url}
                  alt=""
                  fill
                  unoptimized
                  sizes={
                    index === 0
                      ? "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 50vw"
                      : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  }
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
