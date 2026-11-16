// The venue's phone and WhatsApp for the static fallback notice shown when the
// database is down (overview: Failure behavior). They are NEXT_PUBLIC_ values,
// inlined at build time on purpose: the notice must render without touching the
// database, where venue settings live. Set them as Fly build args (fly.toml).

export interface VenueContact {
  phone: string | null;
  whatsapp: string | null;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const venueContact: VenueContact = {
  phone: clean(process.env.NEXT_PUBLIC_VENUE_PHONE),
  whatsapp: clean(process.env.NEXT_PUBLIC_VENUE_WHATSAPP),
};

/** Digits only, as wa.me and tel: links want them. */
export function dialable(number: string): string {
  return number.replace(/[^\d+]/g, "");
}

export function whatsappUrl(number: string): string {
  return `https://wa.me/${dialable(number).replace(/^\+/, "")}`;
}
