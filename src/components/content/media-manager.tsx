"use client";

import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  ACCEPTED_MEDIA,
  deleteMedia,
  formatBytes,
  mediaAlt,
  moveMedia,
  positionChanges,
  updateMedia,
  uploadMedia,
  uploadProblem,
  type DiskSpace,
  type MediaItem,
  type MediaLimits,
} from "@/lib/content-api";

// The media half of the content editor (docs/features/content-management
// design): an uploader with per-file progress, a disk meter, and the ordered
// grid. Reordering has both drag and move buttons so it is keyboard-operable.

type Notice = { ok: boolean; text: string } | null;

interface UploadRow {
  key: string;
  name: string;
  percent: number;
  error: string | null;
}

const cardClass = "rounded-lg bg-surface p-4 shadow-md";

function emptyAlt(item: MediaItem) {
  return { ar: item.altAr, en: item.altEn };
}

export function MediaManager({
  media,
  limits,
  disk,
  onReload,
}: {
  media: MediaItem[];
  limits: MediaLimits;
  disk: DiskSpace;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("Dashboard.content");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const dropArea = useRef<HTMLDivElement>(null);

  const [drafts, setDrafts] = useState<
    Record<number, { ar: string; en: string }>
  >({});
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  function draftFor(item: MediaItem) {
    return drafts[item.id] ?? emptyAlt(item);
  }

  function itemName(item: MediaItem): string {
    return (
      mediaAlt(item, locale) ||
      t(item.kind === "photo" ? "kindPhoto" : "kindVideo")
    );
  }

  async function handleFiles(files: FileList | File[]) {
    const chosen = [...files];
    if (chosen.length === 0) return;
    setNotice(null);

    for (const [index, file] of chosen.entries()) {
      const problem = uploadProblem(file, limits);
      const key = `${file.name}-${file.lastModified}-${index}`;
      if (problem) {
        setUploads((rows) => [
          ...rows,
          {
            key,
            name: file.name,
            percent: 0,
            error:
              problem === "wrongType"
                ? t("wrongType", { name: file.name })
                : t("tooLarge", {
                    name: file.name,
                    limit:
                      file.type.startsWith("video/") ||
                      /\.(mp4|webm|mov|ogv)$/i.test(file.name)
                        ? limits.maxVideoMb
                        : limits.maxPhotoMb,
                  }),
          },
        ]);
        continue;
      }

      setUploads((rows) => [
        ...rows,
        { key, name: file.name, percent: 0, error: null },
      ]);
      const result = await uploadMedia(file, (percent) => {
        setUploads((rows) =>
          rows.map((row) => (row.key === key ? { ...row, percent } : row)),
        );
      });
      setUploads((rows) =>
        rows.map((row) =>
          row.key === key
            ? {
                ...row,
                percent: 100,
                error: result.ok
                  ? null
                  : t("uploadFailed", { name: file.name }),
              }
            : row,
        ),
      );
      if (result.ok) {
        setNotice({ ok: true, text: t("uploaded", { name: file.name }) });
        await onReload();
      } else {
        setNotice({
          ok: false,
          text: t("uploadFailed", { name: file.name }),
        });
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function saveOrder(next: MediaItem[]) {
    const changes = positionChanges(media, next);
    if (changes.length === 0) return;
    setBusy(true);
    setNotice(null);
    let failed = false;
    for (const change of changes) {
      const result = await updateMedia(change.id, {
        position: change.position,
      });
      if (!result.ok) {
        failed = true;
        break;
      }
    }
    await onReload();
    setBusy(false);
    if (failed) setNotice({ ok: false, text: t("mediaFailed") });
  }

  function move(id: number, delta: number) {
    void saveOrder(moveMedia(media, id, delta));
  }

  function dropOn(targetId: number) {
    if (dragging === null || dragging === targetId) return;
    const from = media.findIndex((item) => item.id === dragging);
    const to = media.findIndex((item) => item.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setDragging(null);
    setDropTarget(null);
    void saveOrder(next);
  }

  function onDragStart(event: DragEvent, id: number) {
    setDragging(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  }

  async function saveAlt(item: MediaItem) {
    const draft = draftFor(item);
    if (draft.ar === item.altAr && draft.en === item.altEn) return;
    setBusy(true);
    const result = await updateMedia(item.id, {
      altAr: draft.ar,
      altEn: draft.en,
    });
    setBusy(false);
    if (result.ok) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setNotice({ ok: true, text: t("savedAlt") });
      await onReload();
    } else {
      setNotice({ ok: false, text: t("mediaFailed") });
    }
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(t("confirmDelete"))) return;
    setBusy(true);
    const result = await deleteMedia(item.id);
    setBusy(false);
    if (result.ok) {
      setNotice({ ok: true, text: t("deleted") });
      await onReload();
    } else {
      setNotice({ ok: false, text: t("mediaFailed") });
    }
  }

  const usedPercent =
    disk.totalBytes > 0
      ? Math.min(100, Math.round((disk.usedBytes / disk.totalBytes) * 100))
      : 0;

  return (
    <section className="space-y-4" aria-labelledby="content-media-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="content-media-title" className="text-2xl font-bold">
            {t("media")}
          </h2>
          <p className="text-sm text-muted">{t("mediaHint")}</p>
        </div>
        <div className="min-w-48 text-sm">
          <div className="mb-1 flex justify-between gap-2 text-muted">
            <span>{t("disk")}</span>
            <span dir="ltr">
              {t("diskFree", {
                free: formatBytes(disk.freeBytes, locale),
                total: formatBytes(disk.totalBytes, locale),
              })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t("disk")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usedPercent}
            className="h-2 overflow-hidden rounded-full bg-fill"
          >
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={
            "rounded-sm p-3 text-sm " +
            (notice.ok
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger")
          }
        >
          {notice.text}
        </p>
      )}

      <div
        ref={dropArea}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            dropArea.current?.setAttribute("data-dragover", "true");
          }
        }}
        onDragLeave={() => dropArea.current?.removeAttribute("data-dragover")}
        onDrop={(event) => {
          if (event.dataTransfer.files.length > 0) {
            event.preventDefault();
            dropArea.current?.removeAttribute("data-dragover");
            void handleFiles(event.dataTransfer.files);
          }
        }}
        className="rounded-lg border-2 border-dashed border-border bg-surface p-6 text-center data-[dragover=true]:border-brand data-[dragover=true]:bg-brand-soft"
      >
        <UploadCloud
          aria-hidden="true"
          className="mx-auto size-8 text-brand"
          strokeWidth={1.75}
        />
        <p className="mt-2 font-medium">{t("dropzone")}</p>
        <input
          ref={fileInput}
          id={inputId}
          type="file"
          accept={ACCEPTED_MEDIA}
          multiple
          className="sr-only"
          onChange={(event) =>
            event.target.files
              ? void handleFiles(event.target.files)
              : undefined
          }
        />
        <Button
          type="button"
          variant="outline"
          className="mt-3 rounded-full"
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden />
          {t("upload")}
        </Button>
        <label htmlFor={inputId} className="sr-only">
          {t("upload")}
        </label>
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-label={t("uploadingLabel")}>
          {uploads.map((row) => (
            <li key={row.key} className={cardClass}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{row.name}</span>
                <span dir="ltr" className="tabular-nums text-muted">
                  {row.error ? "—" : `${row.percent}%`}
                </span>
              </div>
              {row.error ? (
                <p className="mt-1 text-sm text-danger" role="alert">
                  {row.error}
                </p>
              ) : (
                <div
                  role="progressbar"
                  aria-label={t("uploading", {
                    name: row.name,
                    percent: row.percent,
                  })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.percent}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-fill"
                >
                  <span
                    className="block h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {media.length === 0 ? (
        <p className="rounded-lg bg-surface p-6 text-center text-muted shadow-md">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item, index) => {
            const draft = draftFor(item);
            const changed = draft.ar !== item.altAr || draft.en !== item.altEn;
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(event) => onDragStart(event, item.id)}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  if (dragging !== null) {
                    event.preventDefault();
                    setDropTarget(item.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropOn(item.id);
                }}
                className={
                  cardClass +
                  " space-y-3 transition-shadow " +
                  (dropTarget === item.id ? "ring-2 ring-brand" : "")
                }
              >
                <div className="relative aspect-video overflow-hidden rounded-md bg-fill">
                  {item.kind === "photo" ? (
                    // The editor's thumbnail is decorative; the alternative text
                    // is edited in the fields below.
                    <Image
                      src={item.url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <video
                      src={item.url}
                      muted
                      playsInline
                      preload="metadata"
                      aria-label={itemName(item)}
                      className="size-full object-cover"
                    />
                  )}
                  <span className="absolute start-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium shadow-sm">
                    {t(item.kind === "photo" ? "kindPhoto" : "kindVideo")}
                  </span>
                  <span className="absolute end-2 top-2 inline-flex items-center rounded-full bg-surface/90 p-1 text-muted shadow-sm">
                    <GripVertical className="size-4" aria-hidden />
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    aria-label={t("moveUp", { name: itemName(item) })}
                    disabled={busy || index === 0}
                    onClick={() => move(item.id, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    aria-label={t("moveDown", { name: itemName(item) })}
                    disabled={busy || index === media.length - 1}
                    onClick={() => move(item.id, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ms-auto rounded-full text-danger"
                    aria-label={`${t("delete")} ${itemName(item)}`}
                    disabled={busy}
                    onClick={() => void remove(item)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t("delete")}
                  </Button>
                </div>

                <p className="text-sm text-muted">{t("altHint")}</p>
                <label className="block space-y-1 text-sm">
                  {t("altAr")}
                  <textarea
                    dir="rtl"
                    rows={2}
                    maxLength={500}
                    value={draft.ar}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...draft, ar: event.target.value },
                      }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  {t("altEn")}
                  <textarea
                    dir="ltr"
                    rows={2}
                    maxLength={500}
                    value={draft.en}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...draft, en: event.target.value },
                      }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={busy || !changed}
                  onClick={() => void saveAlt(item)}
                >
                  {t("saveAlt")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
