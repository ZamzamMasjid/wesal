import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";

import {
  fetchBooking,
  lookupBooking,
  uploadProof,
  type PublicBooking,
} from "../api";
import {
  Banner,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Title,
  row,
} from "../components";
import { countdown, formatTime, dayLabel, money } from "../dates";
import type { Locale, Strings } from "../i18n";
import { colors, spacing } from "../theme";

const STATUS_KEY = {
  held: "awaitingPayment",
  proof_submitted: "awaitingReview",
  confirmed: "confirmed",
  expired: "codeExpired",
  rejected: "notFound",
  cancelled: "closed",
} as const;

export function BookingScreen({
  locale,
  t,
  token,
  onBack,
}: {
  locale: Locale;
  t: Strings;
  token: string | null;
  onBack: () => void;
}) {
  const [activeToken, setActiveToken] = useState<string | null>(token);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupId, setLookupId] = useState("");
  const [seconds, setSeconds] = useState(0);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  async function load(
    target: string,
    { keepNotice = false }: { keepNotice?: boolean } = {},
  ) {
    setLoading(true);
    if (!keepNotice) setNotice(null);
    const result = await fetchBooking(target);
    setLoading(false);
    if (result.ok && result.data) {
      setBooking(result.data);
      setSeconds(
        result.data.deadlineAt
          ? Math.max(
              0,
              Math.ceil(
                (Date.parse(result.data.deadlineAt) -
                  Date.parse(result.data.refreshedAt)) /
                  1000,
              ),
            )
          : 0,
      );
      return;
    }
    setNotice(t.bookingNotFound);
  }

  refreshRef.current = async () => {
    if (activeToken) await load(activeToken);
  };

  useEffect(() => {
    if (activeToken) void load(activeToken);
  }, [activeToken]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [seconds > 0]);

  async function find() {
    if (lookupId.trim() === "" || busy) return;
    setBusy(true);
    setNotice(null);
    const result = await lookupBooking(lookupId.trim());
    setBusy(false);
    if (result.ok && result.data) {
      setActiveToken(result.data.token);
      return;
    }
    setNotice(t.notFound);
  }

  async function pickProof() {
    if (!activeToken || busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice(t.proofHint);
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0]!;
    setBusy(true);
    setNotice(null);
    const result = await uploadProof(activeToken, {
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileName: asset.fileName ?? "proof.jpg",
    });
    setBusy(false);
    if (result.ok) {
      await load(activeToken, { keepNotice: true });
      setNotice(t.proofReceived);
    } else {
      setNotice(t.proofFailed);
    }
  }

  if (!activeToken) {
    return (
      <View style={{ gap: spacing.md }}>
        <Title locale={locale}>{t.booking}</Title>
        <Card>
          <Heading locale={locale}>{t.findBooking}</Heading>
          <Body locale={locale} muted>
            {t.findIntro}
          </Body>
          <Field
            locale={locale}
            label={t.bookingId}
            value={lookupId}
            onChangeText={setLookupId}
          />
          <Button
            locale={locale}
            label={busy ? t.verifying : t.findBooking}
            busy={busy}
            onPress={() => void find()}
          />
          {notice && <Banner locale={locale} tone="error" message={notice} />}
        </Card>
        <Button
          locale={locale}
          variant="ghost"
          label={t.back}
          onPress={onBack}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Title locale={locale}>{t.booking}</Title>
      <Button locale={locale} variant="ghost" label={t.back} onPress={onBack} />

      {notice && (
        <Banner
          locale={locale}
          tone={notice === t.proofReceived ? "success" : "error"}
          message={notice}
        />
      )}

      {loading || !booking ? (
        <Body locale={locale} muted>
          {t.sending}
        </Body>
      ) : (
        <>
          <Card>
            <Heading locale={locale}>
              {locale === "ar"
                ? booking.occasion.nameAr
                : booking.occasion.nameEn}
            </Heading>
            <Body locale={locale}>
              {dayLabel(booking.day, locale)} ·{" "}
              {formatTime(booking.start, locale)} –{" "}
              {formatTime(booking.end, locale)}
            </Body>
            <View style={[row(locale), { justifyContent: "space-between" }]}>
              <Text style={{ color: colors.muted }}>{t.status}</Text>
              <Text style={{ color: colors.brand, fontWeight: "700" }}>
                {t[STATUS_KEY[booking.status]]}
              </Text>
            </View>
            <Body locale={locale} muted>
              {t.bookingId}: {booking.bookingId}
            </Body>
            {booking.status === "held" && booking.deadlineAt && (
              <Body locale={locale}>
                {seconds > 0
                  ? t.timeLeft.replace("{time}", countdown(seconds))
                  : t.timeUp}
              </Body>
            )}
          </Card>

          <Card>
            <Heading locale={locale}>{t.deposit}</Heading>
            <View style={[row(locale), { justifyContent: "space-between" }]}>
              <Text style={{ color: colors.muted }}>{t.price}</Text>
              <Text style={{ color: colors.fg }}>
                {money(locale, booking.priceEgp)}
              </Text>
            </View>
            <View style={[row(locale), { justifyContent: "space-between" }]}>
              <Text style={{ color: colors.muted }}>{t.deposit}</Text>
              <Text style={{ color: colors.fg }}>
                {money(locale, booking.depositEgp)}
              </Text>
            </View>
            <View style={[row(locale), { justifyContent: "space-between" }]}>
              <Text style={{ color: colors.muted }}>{t.remainder}</Text>
              <Text style={{ color: colors.fg }}>
                {booking.remainderPaid
                  ? t.remainderPaid
                  : money(locale, booking.remainderEgp)}
              </Text>
            </View>

            {booking.transfer ? (
              <>
                {booking.transfer.vodafoneCashNumber && (
                  <PressableLine
                    label={t.vodafone}
                    value={booking.transfer.vodafoneCashNumber}
                    locale={locale}
                  />
                )}
                {booking.transfer.instapayAddress && (
                  <PressableLine
                    label={t.instapay}
                    value={booking.transfer.instapayAddress}
                    locale={locale}
                  />
                )}
              </>
            ) : (
              <Body locale={locale} muted>
                {t.paymentUnavailable}
              </Body>
            )}
          </Card>

          {(booking.status === "held" ||
            booking.status === "proof_submitted") && (
            <Card>
              <Heading locale={locale}>{t.proof}</Heading>
              <Body locale={locale} muted>
                {t.proofHint}
              </Body>
              <Button
                locale={locale}
                label={busy ? t.uploading : t.uploadProof}
                busy={busy}
                onPress={() => void pickProof()}
              />
            </Card>
          )}

          <Button
            locale={locale}
            variant="secondary"
            label={t.refresh}
            onPress={() => void refreshRef.current()}
          />
        </>
      )}
    </View>
  );
}

function PressableLine({
  label,
  value,
  locale,
}: {
  label: string;
  value: string;
  locale: Locale;
}) {
  return (
    <View style={[row(locale), { justifyContent: "space-between" }]}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <Text
        accessibilityRole="button"
        onPress={() =>
          void Linking.openURL(`tel:${value.replace(/[^\d+]/g, "")}`)
        }
        style={{ color: colors.brand, fontWeight: "600" }}
      >
        {value}
      </Text>
    </View>
  );
}
