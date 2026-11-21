import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  absoluteUrl,
  fetchContent,
  fetchOccasions,
  type MediaItem,
  type Occasion,
  type SiteContent,
} from "../api";
import {
  Body,
  Banner,
  Button,
  Card,
  Heading,
  Title,
  row,
  styles,
} from "../components";
import { type Locale, type Strings } from "../i18n";
import { money } from "../dates";
import { storedBookings, type StoredBooking } from "../storage";
import { colors, radius, spacing } from "../theme";

export function HomeScreen({
  locale,
  t,
  onCalendar,
  onBooking,
  onStaff,
}: {
  locale: Locale;
  t: Strings;
  onCalendar: () => void;
  onBooking: (token: string) => void;
  onStaff: () => void;
}) {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [bookings, setBookings] = useState<StoredBooking[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void (async () => {
      setBookings(await storedBookings());
      const [contentResult, occasionResult] = await Promise.all([
        fetchContent(),
        fetchOccasions(),
      ]);
      if (contentResult.ok && contentResult.data) {
        setContent(contentResult.data.content);
        setMedia(
          contentResult.data.media.filter((item) => item.kind === "photo"),
        );
      } else {
        setOffline(true);
      }
      if (occasionResult.ok && occasionResult.data) {
        setOccasions(occasionResult.data.occasions);
      }
    })();
  }, []);

  const latest = bookings[0];
  const description =
    locale === "ar" ? content?.descriptionAr : content?.descriptionEn;

  return (
    <View style={{ gap: spacing.md }}>
      <Title locale={locale}>{t.appName}</Title>
      <Body locale={locale} muted>
        {t.venueName}
      </Body>

      {offline && <Banner locale={locale} message={t.offline} tone="error" />}

      {latest && (
        <Pressable onPress={() => onBooking(latest.token)}>
          <Card>
            <Text
              style={[
                styles.heading,
                { textAlign: locale === "ar" ? "right" : "left" },
              ]}
            >
              {t.currentBooking}
            </Text>
            <Body locale={locale}>
              {t.bookingId}: {latest.bookingId}
            </Body>
            <Body locale={locale} muted>
              {t.open} ›
            </Body>
          </Card>
        </Pressable>
      )}

      <Card>
        <Heading locale={locale}>{t.venueName}</Heading>
        {description ? (
          <Body locale={locale} muted>
            {description}
          </Body>
        ) : null}
        <Button
          locale={locale}
          label={t.checkAvailability}
          onPress={onCalendar}
        />
      </Card>

      {media.length > 0 && (
        <>
          <Heading locale={locale}>{t.gallery}</Heading>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
            // In RTL the gallery scrolls from the start side too.
            style={{ flexDirection: locale === "ar" ? "row-reverse" : "row" }}
          >
            {media.map((item) => (
              <Image
                key={item.id}
                source={{ uri: absoluteUrl(item.url) }}
                accessibilityLabel={locale === "ar" ? item.altAr : item.altEn}
                style={{
                  width: 220,
                  height: 150,
                  borderRadius: radius.md,
                  backgroundColor: colors.fill,
                }}
              />
            ))}
          </ScrollView>
        </>
      )}

      <Card>
        <Heading locale={locale}>{t.prices}</Heading>
        {occasions.length === 0 ? (
          <Body locale={locale} muted>
            {t.offline}
          </Body>
        ) : (
          occasions.map((occasion) => (
            <View
              key={occasion.id}
              style={[
                row(locale),
                {
                  justifyContent: "space-between",
                  paddingVertical: spacing.xs,
                },
              ]}
            >
              <Text style={{ fontSize: 16, color: colors.fg }}>
                {locale === "ar" ? occasion.nameAr : occasion.nameEn}
              </Text>
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: colors.fg }}
              >
                {money(locale, occasion.priceEgp)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <View style={[row(locale), { gap: spacing.sm }]}>
        {content?.contactPhone ? (
          <View style={{ flex: 1 }}>
            <Button
              locale={locale}
              variant="secondary"
              label={t.call}
              onPress={() =>
                void Linking.openURL(`tel:${content.contactPhone}`)
              }
            />
          </View>
        ) : null}
        {content?.contactWhatsapp ? (
          <View style={{ flex: 1 }}>
            <Button
              locale={locale}
              variant="secondary"
              label={t.whatsapp}
              onPress={() =>
                void Linking.openURL(
                  `https://wa.me/${content.contactWhatsapp.replace(/[^\d]/g, "")}`,
                )
              }
            />
          </View>
        ) : null}
      </View>

      <Pressable onPress={onStaff} style={{ paddingVertical: spacing.md }}>
        <Text
          style={{ textAlign: "center", color: colors.muted, fontSize: 14 }}
        >
          {t.staffLogin}
        </Text>
      </Pressable>
    </View>
  );
}
