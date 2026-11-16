"use client";

import { dialable, venueContact, whatsappUrl } from "@/lib/venue-contact";

// Last resort when even the locale layout fails: no providers, no catalogs, so
// the text is written out in both languages here.
export default function GlobalError() {
  const { phone, whatsapp } = venueContact;
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem" }}>
        <h1>الخدمة غير متاحة مؤقتًا</h1>
        <p>
          نعتذر عن ذلك. للحجز تواصل معنا مباشرة
          {phone && (
            <>
              {" "}
              <a href={`tel:${dialable(phone)}`}>
                <bdi dir="ltr">{phone}</bdi>
              </a>
            </>
          )}
          {whatsapp && (
            <>
              {" "}
              <a href={whatsappUrl(whatsapp)}>واتساب</a>
            </>
          )}
        </p>
        <h1 dir="ltr" lang="en">
          Temporarily unavailable
        </h1>
        <p dir="ltr" lang="en">
          Sorry about that. To book, contact the venue directly
          {phone && (
            <>
              {": "}
              <a href={`tel:${dialable(phone)}`}>{phone}</a>
            </>
          )}
          {whatsapp && (
            <>
              {" · "}
              <a href={whatsappUrl(whatsapp)}>WhatsApp</a>
            </>
          )}
          .
        </p>
      </body>
    </html>
  );
}
