import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import {
  fetchAvailability,
  type Availability,
  type AvailabilityDay,
  type Slot,
} from "../api";
import {
  Banner,
  Body,
  Button,
  Card,
  Heading,
  Text,
  Title,
  align,
  styles,
} from "../components";
import {
  addMonths,
  cairoToday,
  dayLabel,
  firstDayOfMonth,
  formatTime,
  lastDayOfMonth,
  monthLabel,
  monthOf,
} from "../dates";
import type { Locale, Strings } from "../i18n";
import { colors, radius, spacing } from "../theme";

export function CalendarScreen({
  locale,
  t,
  onBook,
  initialDay,
}: {
  locale: Locale;
  t: Strings;
  onBook: (day: string, slot: Slot) => void;
  initialDay?: string;
}) {
  const today = cairoToday();
  const [month, setMonth] = useState(monthOf(initialDay ?? today));
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function load(target: string) {
    setLoading(true);
    setFailed(false);
    const result = await fetchAvailability(
      firstDayOfMonth(target),
      lastDayOfMonth(target),
    );
    setLoading(false);
    if (result.ok && result.data) setData(result.data);
    else setFailed(true);
  }

  useEffect(() => {
    void load(month);
  }, [month]);

  const stateLabel = (slot: Slot): string => {
    switch (slot.state) {
      case "free":
        return t.free;
      case "awaiting_payment":
        return t.awaitingPayment;
      case "awaiting_review":
        return t.awaitingReview;
      case "confirmed":
        return t.confirmed;
      default:
        return t.closed;
    }
  };

  const openDays = (data?.days ?? []).filter(
    (entry) => entry.slots.length > 0 && !entry.closed,
  );

  return (
    <View style={{ gap: spacing.md }}>
      <Title locale={locale}>{t.availability}</Title>

      <View
        style={[
          styles.row,
          { alignItems: "center", justifyContent: "space-between" },
        ]}
      >
        <Button
          locale={locale}
          variant="secondary"
          label={locale === "ar" ? "›" : "‹"}
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.fg }}>
          {monthLabel(month, locale)}
        </Text>
        <Button
          locale={locale}
          variant="secondary"
          label={locale === "ar" ? "‹" : "›"}
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>

      {failed && (
        <Banner locale={locale} tone="error" message={`${t.offline}`} />
      )}

      {loading ? (
        <Body locale={locale} muted>
          {t.sending}
        </Body>
      ) : openDays.length === 0 ? (
        <Banner locale={locale} message={t.noSlots} />
      ) : (
        openDays.map((entry: AvailabilityDay) => (
          <Card key={entry.day}>
            <Heading locale={locale}>{dayLabel(entry.day, locale)}</Heading>
            {entry.slots.map((slot) => {
              const bookable = slot.action === "book" && slot.state === "free";
              return (
                <Pressable
                  key={`${slot.start}-${slot.end}`}
                  disabled={!bookable}
                  onPress={() => onBook(entry.day, slot)}
                  style={{
                    backgroundColor: bookable ? colors.accentSoft : colors.bg,
                    borderRadius: radius.pill,
                    padding: spacing.md,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minHeight: 48,
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.fg }}>
                    {formatTime(slot.start, locale)} –{" "}
                    {formatTime(slot.end, locale)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: bookable ? colors.accent : colors.muted,
                      fontWeight: "600",
                    }}
                  >
                    {bookable ? t.book : stateLabel(slot)}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        ))
      )}

      <Text style={[styles.body, { color: colors.muted }, align(locale)]}>
        {data?.today === today ? "" : `${t.availability} · ${today}`}
      </Text>
    </View>
  );
}
