"use client";

import { ImageUp, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  looksLikeProof,
  MAX_PROOF_BYTES,
  PROOF_ACCEPT,
  proofSizeLabel,
  uploadProof,
  type ProofUploaded,
} from "@/lib/proof-api";
import { venueContact, whatsappUrl } from "@/lib/venue-contact";

// The upload area of the booking page (docs/features/payment-proof). It shows
// the chosen image before sending, reports real upload progress, and maps the
// server's stable error codes to one bilingual next step. The WhatsApp button
// is the way out when the volume is unwritable: it opens a chat prefilled with
// the booking ID, and staff mark the proof received from the dashboard.

export interface ProofUploadProps {
  token: string;
  bookingId: string;
  status: "held" | "proof_submitted";
  onUploaded: (proof: ProofUploaded) => void;
  /** The hold ended before the image arrived; the page should show it expired. */
  onExpired: () => void;
}

const primary =
  "h-(--size-touch) w-full rounded-full bg-brand text-brand-fg hover:bg-brand-hover";

export function ProofUpload({
  token,
  bookingId,
  status,
  onUploaded,
  onExpired,
}: ProofUploadProps) {
  const t = useTranslations("BookingPage.upload");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{
    file: File;
    preview: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(false);

  // Release the preview URL when the chosen image is replaced or the page goes.
  useEffect(() => {
    if (!selected?.preview) return;
    return () => URL.revokeObjectURL(selected.preview!);
  }, [selected]);

  function choose() {
    setError(null);
    setReceived(false);
    inputRef.current?.click();
  }

  function onChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    // Reset the input so choosing the same file again still fires a change.
    event.target.value = "";
    if (!chosen) return;
    setReceived(false);
    if (chosen.size > MAX_PROOF_BYTES) {
      setSelected(null);
      setError(t("tooLarge"));
      return;
    }
    if (!looksLikeProof(chosen)) {
      setSelected(null);
      setError(t("wrongType"));
      return;
    }
    const preview =
      typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(chosen)
        : null;
    setError(null);
    setSelected({ file: chosen, preview });
  }

  async function send() {
    const file = selected?.file;
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    const result = await uploadProof(token, file, (fraction) =>
      setProgress(Math.round(fraction * 100)),
    );
    setBusy(false);

    if (result.ok && result.data) {
      setSelected(null);
      setReceived(true);
      setProgress(0);
      onUploaded(result.data);
      return;
    }

    switch (result.error?.code) {
      case "HOLD_EXPIRED":
        setSelected(null);
        setError(t("expired"));
        onExpired();
        break;
      case "INVALID_FILE":
        setError(t("wrongType"));
        break;
      case "FILE_TOO_LARGE":
        setError(t("tooLarge"));
        break;
      case "SERVICE_UNAVAILABLE":
        setError(t("unavailable"));
        break;
      default:
        setError(t("failed"));
    }
  }

  const whatsapp = venueContact.whatsapp;
  const whatsappText = t("whatsappMessage", { bookingId });
  const percent = Math.round(progress);

  return (
    <section
      aria-labelledby="proof-upload-heading"
      className="space-y-4 rounded-lg bg-surface p-6 shadow-md"
    >
      <div className="space-y-1">
        <h2 id="proof-upload-heading" className="text-lg font-bold">
          {status === "held" ? t("title") : t("titleAnother")}
        </h2>
        <p className="text-sm text-muted">{t("hint")}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PROOF_ACCEPT}
        className="sr-only"
        aria-label={status === "held" ? t("action") : t("actionAnother")}
        onChange={onChosen}
      />

      {selected ? (
        <div className="space-y-3">
          {selected.preview && (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview
            <img
              src={selected.preview}
              alt={t("preview")}
              className="max-h-64 w-auto rounded-lg border border-border object-contain"
            />
          )}
          <p className="text-sm text-muted">
            <bdi dir="ltr">{selected.file.name}</bdi>
            <span aria-hidden="true"> · </span>
            <bdi>{proofSizeLabel(selected.file.size, locale)}</bdi>
          </p>
          {busy && (
            <div
              role="progressbar"
              aria-label={t("progressLabel")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 w-full overflow-hidden rounded-full bg-fill"
            >
              <div
                className="h-full bg-brand transition-[width] motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={`${primary} flex-1`}
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? t("uploadingPercent", { percent }) : t("send")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-(--size-touch) rounded-full"
              disabled={busy}
              onClick={choose}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" className={primary} onClick={choose}>
          <ImageUp aria-hidden="true" className="size-5" strokeWidth={1.75} />
          {status === "held" ? t("action") : t("actionAnother")}
        </Button>
      )}

      {received && (
        <p role="status" className="text-sm font-medium text-accent">
          {t("received")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {status === "held" && whatsapp && (
        <p className="text-sm text-muted">
          <a
            href={whatsappUrl(whatsapp, whatsappText)}
            className="inline-flex items-center gap-1.5 font-medium text-brand underline-offset-4 hover:underline"
          >
            <MessageCircle
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
            {t("whatsapp")}
          </a>
        </p>
      )}
    </section>
  );
}
