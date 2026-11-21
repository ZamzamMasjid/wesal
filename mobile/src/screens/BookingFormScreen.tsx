import { useState } from "react";
import { Text, View } from "react-native";

import {
  checkVerificationCode,
  createHold,
  requestVerificationCode,
  type Occasion,
} from "../api";
import {
  Banner,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Title,
} from "../components";
import { formatTime } from "../dates";
import type { Locale, Strings } from "../i18n";
import { rememberBooking } from "../storage";
import { colors, spacing } from "../theme";

type Step = "details" | "code" | "held";

export function BookingFormScreen({
  locale,
  t,
  day,
  start,
  end,
  occasions,
  onHeld,
  onBack,
  onCalendar,
}: {
  locale: Locale;
  t: Strings;
  day: string;
  start: string;
  end: string;
  occasions: Occasion[];
  onHeld: (token: string) => void;
  onBack: () => void;
  onCalendar: () => void;
}) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [occasionId, setOccasionId] = useState<number | null>(
    occasions[0]?.id ?? null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [held, setHeld] = useState<{ token: string; bookingId: string } | null>(
    null,
  );

  const chosen = occasions.find((occasion) => occasion.id === occasionId);

  function messageFor(code: string): string {
    switch (code) {
      case "SLOT_TAKEN":
        return t.slotTaken;
      case "SLOT_UNAVAILABLE":
        return t.slotUnavailable;
      case "PHONE_HOLD_EXISTS":
        return t.phoneHold;
      case "CODE_INVALID":
        return t.codeInvalid;
      case "CODE_EXPIRED":
        return t.codeExpired;
      default:
        return t.genericError;
    }
  }

  async function sendCode() {
    if (busy) return;
    if (name.trim() === "" || phone.trim() === "" || occasionId === null) {
      setNotice(t.required);
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await requestVerificationCode(phone.trim(), locale);
    setBusy(false);
    if (result.ok && result.data) {
      setPhone(result.data.phone);
      setStep("code");
      return;
    }
    setNotice(messageFor(result.error?.code ?? ""));
  }

  async function verify() {
    if (busy || occasionId === null) return;
    setBusy(true);
    setNotice(null);
    const checked = await checkVerificationCode(phone.trim(), code.trim());
    if (!checked.ok || !checked.data) {
      setBusy(false);
      setNotice(messageFor(checked.error?.code ?? ""));
      return;
    }
    const hold = await createHold({
      day,
      start,
      end,
      occasionId,
      name: name.trim(),
      phone: checked.data.phone,
      token: checked.data.token,
      locale,
    });
    setBusy(false);
    if (hold.ok && hold.data) {
      await rememberBooking({
        token: hold.data.linkToken,
        bookingId: hold.data.bookingId,
      });
      setHeld({ token: hold.data.linkToken, bookingId: hold.data.bookingId });
      setStep("held");
      return;
    }
    setNotice(messageFor(hold.error?.code ?? ""));
  }

  if (step === "held" && held) {
    return (
      <View style={{ gap: spacing.md }}>
        <Title locale={locale}>{t.held}</Title>
        <Card>
          <Body locale={locale}>{t.heldBody}</Body>
          <Body locale={locale} muted>
            {t.bookingId}: {held.bookingId}
          </Body>
          <Button
            locale={locale}
            label={t.openBooking}
            onPress={() => onHeld(held.token)}
          />
          <Button
            locale={locale}
            variant="ghost"
            label={t.back}
            onPress={onCalendar}
          />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Title locale={locale}>{t.book}</Title>
      <Button locale={locale} variant="ghost" label={t.back} onPress={onBack} />

      <Card>
        <Heading locale={locale}>
          {formatTime(start, locale)} – {formatTime(end, locale)}
        </Heading>
        <Body locale={locale} muted>
          {day}
        </Body>
      </Card>

      {notice && <Banner locale={locale} tone="error" message={notice} />}

      {step === "details" ? (
        <Card>
          <Heading locale={locale}>{t.yourDetails}</Heading>
          <Field
            locale={locale}
            label={t.name}
            value={name}
            onChangeText={setName}
          />
          <Field
            locale={locale}
            label={t.phone}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
          />
          <Body locale={locale} muted>
            {t.phoneHint}
          </Body>

          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.fg }}>
            {t.chooseOccasion}
          </Text>
          {occasions.map((occasion) => {
            const selected = occasion.id === occasionId;
            return (
              <Button
                key={occasion.id}
                locale={locale}
                variant={selected ? "primary" : "secondary"}
                label={`${locale === "ar" ? occasion.nameAr : occasion.nameEn} · ${occasion.priceEgp} ${t.currency}`}
                onPress={() => setOccasionId(occasion.id)}
              />
            );
          })}
          {chosen && (
            <Body locale={locale} muted>
              {t.price}: {chosen.priceEgp} {t.currency}
            </Body>
          )}

          <Button
            locale={locale}
            label={busy ? t.sending : t.sendCode}
            busy={busy}
            onPress={() => void sendCode()}
          />
        </Card>
      ) : (
        <Card>
          <Heading locale={locale}>{t.codeTitle}</Heading>
          <Body locale={locale} muted>
            {t.codeSent.replace("{phone}", phone)}
          </Body>
          <Field
            locale={locale}
            label={t.code}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
          <Button
            locale={locale}
            label={busy ? t.verifying : t.bookingNow}
            busy={busy}
            onPress={() => void verify()}
          />
          <Button
            locale={locale}
            variant="ghost"
            label={t.changeNumber}
            onPress={() => {
              setNotice(null);
              setCode("");
              setStep("details");
            }}
          />
        </Card>
      )}
    </View>
  );
}
