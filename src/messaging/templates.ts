import { z } from "zod";

import { VENUE_TIME_ZONE } from "@/lib/clock";

// Message templates, in Arabic and English, sent in the recipient's language.
// Delivery is at-least-once, so every text is harmless to receive twice. Values
// are plain strings so they can be stored on the outbox row as-is.

export type Locale = "ar" | "en";
export type TemplateName =
  | "code"
  | "booking-link"
  | "booking-confirmed"
  | "staff-alert"
  | "slot-alert";

const text = z.string().min(1).max(500);
const instant = z.iso.datetime({ offset: true });

/** What each template needs. Parsed before a message is queued or sent. */
export const TEMPLATE_VALUES = {
  /** Verification code, sent inline (ADR-011). `minutes` is how long it works. */
  code: z.object({ code: z.string().regex(/^\d{4,8}$/), minutes: z.string() }),
  /** The customer's private booking link and the hold deadline. */
  "booking-link": z.object({ link: z.url(), deadlineAt: instant }),
  /**
   * A booking staff entered by phone or in person, which starts confirmed: the
   * customer gets the booking page link, with no deadline to beat.
   */
  "booking-confirmed": z.object({ link: z.url() }),
  /**
   * Alert to staff: a link to the review page, never the screenshot (ADR-013).
   * `kind` is "proof" (a proof is waiting) or "urgent" (a hold close to its slot).
   */
  "staff-alert": z.object({
    kind: z.enum(["proof", "urgent"]),
    link: z.url(),
    occasion: text,
    slotStartAt: instant,
    customerName: text,
    depositEgp: z.string().optional(),
  }),
  /**
   * A watched slot just freed up. `link` opens the booking form for that slot;
   * `unsubscribe` is the one-use link that ends the subscription.
   */
  "slot-alert": z.object({
    link: z.url(),
    unsubscribe: z.url(),
    slotStartAt: instant,
  }),
} as const satisfies Record<TemplateName, z.ZodType>;

export type TemplateValues<T extends TemplateName> = z.input<
  (typeof TEMPLATE_VALUES)[T]
>;

type Values = Record<string, string>;
type Renderer = (v: Values, locale: Locale) => string;

const LOCALE_TAG: Record<Locale, string> = {
  // Latin digits in both languages: phone numbers and codes use them too.
  ar: "ar-EG-u-nu-latn",
  en: "en-GB",
};

/** "Thu 24 Dec, 18:30" in the venue's time zone. */
function when(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone: VENUE_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function time(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone: VENUE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const RENDERERS: Record<TemplateName, Record<Locale, Renderer>> = {
  code: {
    ar: (v) =>
      `رمز التحقق في وصال: ${v.code}\nصالح لمدة ${v.minutes} دقائق. لا تشاركه مع أحد.`,
    en: (v) =>
      `Your Wesal verification code: ${v.code}\nValid for ${v.minutes} minutes. Do not share it with anyone.`,
  },
  "booking-link": {
    ar: (v, l) =>
      `تم حجز موعدك مؤقتًا في وصال. ارفع إثبات دفع العربون قبل الساعة ${time(v.deadlineAt!, l)} وإلا يُلغى الحجز.\n${v.link}`,
    en: (v, l) =>
      `Your Wesal slot is held. Upload your deposit proof before ${time(v.deadlineAt!, l)} or the hold is released.\n${v.link}`,
  },
  "booking-confirmed": {
    ar: (v) => `تم تأكيد حجزك في وصال. رابط حجزك:\n${v.link}`,
    en: (v) => `Your Wesal booking is confirmed. Your booking link:\n${v.link}`,
  },
  "staff-alert": {
    ar: (v, l) =>
      v.kind === "proof"
        ? `إثبات دفع جديد بانتظار المراجعة: ${v.customerName}، ${v.occasion}، ${when(v.slotStartAt!, l)}${
            v.depositEgp ? `، العربون ${v.depositEgp} ج.م` : ""
          }\n${v.link}`
        : `حجز عاجل لموعد قريب: ${v.customerName}، ${v.occasion}، ${when(v.slotStartAt!, l)}. انتظر إثبات الدفع.\n${v.link}`,
    en: (v, l) =>
      v.kind === "proof"
        ? `New payment proof to review: ${v.customerName}, ${v.occasion}, ${when(v.slotStartAt!, l)}${
            v.depositEgp ? `, deposit EGP ${v.depositEgp}` : ""
          }\n${v.link}`
        : `Urgent hold on a slot starting soon: ${v.customerName}, ${v.occasion}, ${when(v.slotStartAt!, l)}. Watch for the proof.\n${v.link}`,
  },
  "slot-alert": {
    ar: (v, l) =>
      `توفّر موعد ${when(v.slotStartAt!, l)} في وصال. يمكنك حجزه الآن:\n${v.link}\nلإلغاء التنبيه: ${v.unsubscribe}`,
    en: (v, l) =>
      `The ${when(v.slotStartAt!, l)} slot at Wesal is free again. Book it now:\n${v.link}\nTo stop these alerts: ${v.unsubscribe}`,
  },
};

export const TEMPLATE_NAMES = Object.keys(RENDERERS) as TemplateName[];

/** Validates `values` for the template and returns the message text. */
export function renderTemplate<T extends TemplateName>(
  template: T,
  locale: Locale,
  values: TemplateValues<T>,
): string {
  const parsed = TEMPLATE_VALUES[template].parse(values) as Values;
  return RENDERERS[template][locale](parsed, locale);
}
