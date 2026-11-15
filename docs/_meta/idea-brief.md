---
type: idea-brief
title: Wesal
status: approved
last_completed_stage: 7
created: 2026-11-14
last_modified: 2026-11-14
---

# Wesal (وصال)

**The booking site for Wesal mosque and event hall: see what's free and what it costs, hold a slot from your phone, and secure it with a deposit transfer.**

## The idea

Wesal is the online front door for one venue, the Wesal mosque and event hall. Families use it to book the place for Islamic occasions: weddings, engagement parties, nikah and marriage contract signings, and also funerals. It is Arabic-first and fully available in English. The web app comes first; a mobile app follows.

A visitor opens the landing page and sees the venue in photos and video, the price for each occasion, and a calendar of slots. They pick a free slot and an occasion, give their name and phone number, and verify the phone with a code. The slot is then held for 20 minutes while they transfer a deposit by Vodafone Cash or InstaPay and upload a screenshot of the transfer. The owner checks that the money arrived on his own phone and confirms. If no proof arrives in time, the hold disappears on its own and the slot is open to everyone again.

The idea has two halves that carry equal weight. For families, it is booking without a single phone call. For the owner, it is one trustworthy calendar that holds every booking, including the ones taken by phone or in person, with no unpaid holds sitting on it.

Unlike booking a hall by phone or WhatsApp, Wesal shows real availability and prices publicly, lets a family hold a date instantly, and releases any hold that isn't paid for. The comparison is the phone-call status quo, not other booking apps. Slots that are taken stay visible but disabled, each showing its state, so the calendar reads as honest and busy rather than empty.

**Who it is for:** anyone local booking any occasion. Version one is deliberately not narrowed to one persona; weddings, engagements, nikah and funerals weigh equally. The second user is the venue owner and a few staff.

**How we will know it works:**

- People stop messaging the owner to ask whether a date is free or what it costs.
- The owner's first contact with a customer is a notification with a payment screenshot attached.
- No date is ever promised to two families, including phone bookings.
- Nobody sits on a date without paying; unpaid holds vanish on their own.

## Chosen shape

The seed arrived well defined, so the session sharpened it rather than exploring alternatives. The shape is the seed as written, plus two additions:

- **Owner-entered bookings and blocked dates.** The owner and staff record phone and walk-in bookings and close dates from the dashboard, which makes the public calendar the single record of every booking.
- **A private booking page per booking.** No account or password. The link is sent by WhatsApp when available and by SMS when not, and the page can also be found on the site by booking ID.

Taken from the options passed over: SMS as the fallback channel (the user's own addition), and lookup by booking ID alongside the link. Lookup by phone number was chosen at first and removed in the stress test.

## Domain decisions

**Slots.** The owner defines the bookable periods with his own start and end times (for example 2:00–4:00 and 4:30–7:00). They are laid out as a weekly pattern, so each weekday can have its own slots, with per-date exceptions: different slots on a specific date, or the date closed.

**Spaces.** One venue, one booking. A booking takes the whole place, mosque and hall, for that slot.

**Pricing.** Price depends on the occasion only, whatever the slot. The owner sets one price for each occasion he lists.

**Deposit.** One site-wide percentage of the occasion price, set by the owner. The amount is calculated and shown on each booking.

**Funerals.** Same flow as every other occasion, with their own price.

**Booking workflow.**

1. Visitor picks a day, a free slot and an occasion, and enters name and phone.
2. The phone is verified by a code. Only then does the hold start.
3. The slot is held for 20 minutes. A link to the private booking page is sent by WhatsApp or SMS.
4. The booking page shows the Vodafone Cash number or InstaPay address, the deposit amount, the booking ID and the countdown.
5. The customer transfers and uploads the screenshot, or sends it through the WhatsApp button with the booking ID attached.
6. Upload stops the countdown. The slot shows as proof sent, awaiting review, and the owner and staff are notified.
7. The owner confirms, and the slot is booked. Or he rejects, and the slot becomes free at once; the customer starts again like anyone else.
8. If no proof is uploaded within the 20 minutes, the booking is cancelled automatically and the slot reopens.

There is no reminder message before the deadline and no late-night extension. Both were in the original seed and were dropped once the hold became 20 minutes, because the customer only has to upload within the window and the owner can review whenever he is available.

**Simultaneous bookings.** Two people can never hold the same day and slot. The one who arrives second sees an immediate message that the slot is currently being booked by someone else, and can pick another or try again later.

**Slots starting soon.** The payment deadline never runs past a set time before the slot starts, and bookings for near slots are flagged to the owner as urgent.

**Slot states shown publicly.** Free; provisionally booked, awaiting payment; proof sent, awaiting review; confirmed; closed by owner. Every state except free is visible but disabled.

**After confirmation.** Handled offline. The remainder is paid at the venue. Cancellations and refunds are settled by phone under a policy text shown on the site. In the dashboard the owner can cancel a booking and mark the remainder as paid.

**Dashboard and roles.** Owner plus limited staff. Staff confirm or reject payments and add phone and walk-in bookings. Only the owner changes prices, slots, payment numbers, the deposit percentage and site content.

**Contact.** The landing page carries a phone number for inquiries and a WhatsApp contact.

**Key objects.** Weekly slot pattern and date exception; occasion type with its price; booking (customer name, phone, occasion, slot, status, deposit amount, booking ID, whether it came online or was entered by staff); payment proof; staff account; site content (description, media, policy text, payment details).

**Frequency.** For a customer, rare and high-stakes, usually once. For the owner, daily and driven by notifications.

## Stress test

| Challenge | Resolution | Detail |
|---|---|---|
| Automated WhatsApp and SMS need a paid provider, approved templates and a per-message fee | Defense | The setup effort and running cost are accepted. WhatsApp first, SMS fallback. |
| Lookup by phone number alone lets a stranger see a family's occasion and date | Mutation | Phone lookup removed. A booking is found only through its private link or its booking ID, so booking IDs must not be guessable. |
| A slot starting sooner than the payment window could begin before payment is reviewed | Mutation | Every hold is 20 minutes, the deadline never passes a set time before the slot starts, and near bookings are flagged urgent. The 30-minute reminder and the late-night extension were dropped. |
| Families may still phone or visit before paying, so online bookings could be the minority | Defense | The calendar is the value either way: callers already know the date is free and the price, and the owner enters their booking in the same calendar. The landing page gets a phone number and WhatsApp contact. No "visit first" note. |

## Risks carried forward

No challenge was closed as an accepted risk. Two cost concerns about settled decisions were noted by the agent during the session, not raised by the user, and are carried here so they are not lost:

- **The 20-minute window is tight.** A customer who has to top up a wallet or ask a relative to make the transfer may run out of time, lose the hold and have to start again.
- **A hold has no timer once proof is uploaded.** How long a slot stays locked depends on how fast the owner reviews, and any uploaded image, genuine or not, locks the slot until then.

## v1 boundary

**v1 essence**

- An Arabic-first, bilingual landing page: description, photos and videos, price per occasion, policy text, phone number and WhatsApp contact.
- A public calendar showing every slot's state, with taken slots visible but disabled.
- Hold-and-pay booking: pick slot and occasion, verify the phone by code, transfer the deposit, upload the screenshot, and follow it on a private booking page reached by link or booking ID.
- Owner review: notification, confirm or reject, and automatic expiry of unpaid holds.
- Owner setup: weekly slot pattern with date exceptions, occasion prices, deposit percentage, payment details, site content and blocked dates.
- Phone and walk-in bookings entered from the dashboard, with a limited staff role.
- Automated WhatsApp messages with SMS fallback.

**Later** (still wanted, after version one)

- The mobile app: the same as the web for customers, with push notifications for the owner and staff.
- "Tell me if this slot frees up" for people watching a provisionally booked slot.
- Owner reports: bookings and income by month and by occasion.

**Not this**

- Not a marketplace. One venue only.
- No card payments and no automatic payment checking. The owner verifies transfers by eye.
- No customer accounts or passwords.
- No collecting the remainder, refunds or cancellations online.
- Not an event-planning service: no catering, decoration or extras.

## Bootstrap Seed Prompt

```
I want to build Wesal (وصال), the booking web app for a single venue: the Wesal mosque and event hall. It lets families see when the venue is free and what it costs, hold a slot from their phone, and secure it with a deposit transfer, without a phone call. It also gives me, the owner, one trustworthy calendar of every booking. It is Arabic-first and fully bilingual, Arabic and English. Project class: a web app first; a mobile app comes later.

Users: anyone local booking a wedding, engagement party, nikah or marriage contract signing, or a funeral, all weighted equally. The second user is me and a few staff.

How it works: the landing page shows a description, photos and videos, a price per occasion, a policy text, a phone number and a WhatsApp contact, plus a calendar of slots. The customer picks a free slot and an occasion, enters name and phone, and verifies the phone by a code. The slot is held for 20 minutes. A private booking page, with no account, is sent as a link by WhatsApp, or by SMS if WhatsApp is unavailable, and can also be found by booking ID. It shows my Vodafone Cash number or InstaPay address, the deposit amount, the booking ID and a countdown. The customer uploads a screenshot of the transfer, which stops the countdown. I get notified, check the money on my phone, and confirm or reject. A rejected or expired booking frees the slot immediately. Taken slots stay visible but disabled, each showing its state: awaiting payment, awaiting review, confirmed, or closed.

Rules: one booking takes the whole venue. I define slots as a weekly pattern with per-date exceptions. Price depends on the occasion only, not the slot. The deposit is one percentage of that price. Two people can never hold the same slot; the second sees a message at once. I and my staff can enter phone and walk-in bookings and I can block dates. Staff can confirm payments and add bookings; only I change prices, slots, payment details and content. The remainder, cancellations and refunds are handled offline; I can cancel a booking and mark the remainder paid.

Success means: every booking, including phone bookings, appears on the public calendar; no slot ever has two active bookings; an unpaid hold is released automatically after 20 minutes; a customer can go from the landing page to an uploaded proof without contacting me; and I can confirm a booking straight from a notification that includes the screenshot.

Deferred, still wanted after the first version: the mobile app for customers with push notifications for me and my staff; a "tell me if this slot frees up" alert; and owner reports of bookings and income by month and occasion.

Out of scope: a marketplace of several venues, card payments or automatic payment checking, customer accounts and passwords, collecting the remainder or refunds online, and event-planning extras such as catering or decoration.
```

## Appendix: original seed (verbatim)

> i want to create a web and mobile app, arabic first, but supports both arabic and english to reserve wesal mosque and event hall  https://maps.app.goo.gl/7PPWiLXvXdy6cEjU6
> you will find some photoes in the above link, start with the webapp, this is an application to reserve this mosuqe to islamic events, like wedding,  Engagement party, Nikah or Marriage contract signing and so on, and also sad evenets like funeral
>
> the application has landing page that has app brief description, mosque photoes and videos, and prices, and available time slots to reserve the mosque, all other reserved time slots should apears disabled
>
> خطوات سير عملية الحجز (Booking Flow)
>
> • اختيار الموعد وإدخال البيانات: يختار العميل اليوم والفترة المتاحة، ثم يكتب اسمه ورقم هاتفه.
> • تفعيل الحجز المبدئي (Pending Payment): بمجرد ضغط العميل على "احجز الآن"، يتحول الموعد في النظام إلى "قيد الانتظار" لمدة محددة (مثلاً ساعتين أو 3 ساعات).
> • عرض بيانات التحويل: تظهر للعميل صفحة تحتوي على رقم فودافون كاش أو عنوان إنستا باي (IPA)، وقيمة العربون المطلوب، ورقم الطلب (Booking ID).
> • رفع إثبات الدفع: يقوم العميل بتحويل المبلغ ثم يرفع صورة التحويل (Screenshot) في نفس الصفحة أو يرسلها عبر زر واتساب مدمج مع رقم الطلب.
> • مراجعة الإدارة والتأكيد النهائي: يصلك إشعار كصاحب قاعة، فتتأكد من وصول المبلغ على هاتفك، ثم تضغط "تأكيد الحجز" في لوحة التحكم ليتحول الموعد إلى محجوز نهائياً (Confirmed).
> • الإلغاء التلقائي (Auto-Expiration): إذا انتهت المهلة (الساعتين) ولم يرفع العميل صورة التحويل، يقوم النظام تلقائياً بإلغاء الطلب وإعادة فتح الموعد للجمهور.
>
> 2. حل مشكلة اختيار أكثر من مستخدم لنفس الموعد في نفس اللحظة
>
> لمنع حدوث تضارب (Race Condition) إذا ضغط شخصان على زر الحجز في نفس الثانية تماماً، يجب على المبرمج تطبيق هذه الحلول التقنية في الخلفية (Backend):
> • القيود الفريدة في قاعدة البيانات (Unique Constraints): يتم جعل (تاريخ اليوم + الفترة الزمنية) حقلين غير قابلين للتكرار في جدول الحجوزات النشطة. قاعدة البيانات سترفض تلقائياً أي محاولة ثانية لإدخال نفس الموعد في نفس اللحظة.
> • قفل الصفوف أثناء المعاملة (Database Transactions & Row Locking): عند ضغط العميل على زر الحجز، يقوم السيرفر بقفل هذا الموعد أجزاءً من الثانية للتأكد من حالته وتحديثها، ولا يسمح لأي طلب آخر بقراءة الموعد إلا بعد انتهاء العملية الأولى.
> • رسالة تنبيه فورية للطرف الثاني: الشخص الذي وصل طلبه متأخراً بجزء من الثانية ستظهر له رسالة فورية: "عذراً، هذا الموعد قيد الحجز حالياً من قبل عميل آخر. يرجى المحاولة بعد ساعتين إذا لم يكتمل حجزه، أو اختيار موعد آخر."
>
> 3. نصائح إضافية لنجاح هذا النظام
>
> • حالات الموعد في الواجهة (UI): يفضل أن يظهر الموعد المحجوز مبدئياً بلون مختلف (مثل الأصفر) ومكتوب عليه "محجوز مبدئياً - في انتظار الدفع" بدلاً من إخفائه تماماً، فهذا يعطي مصداقية للموقع ويشجع العملاء الآخرين على متابعة الصفحة تحسباً لإلغائه.
> • إشعارات الواتساب التلقائية: اربط الموقع بخدمة رسائل واتساب لإرسال تذكير للعميل قبل انتهاء مهلة الدفع بـ 30 دقيقة، مما يرفع من نسبة إتمام الحجوزات.
> • تحديد ساعات العمل: إذا كانت الحجوزات تتم ليلاً في وقت متأخر (مثلاً الساعة 3 فجراً)، يفضل أن تمتد مهلة الدفع تلقائياً حتى الساعة 11 صباحاً لتتمكن من مراجعة التحويلات في وقت مناسب.

