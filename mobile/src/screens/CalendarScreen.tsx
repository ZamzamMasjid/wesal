import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  fetchAvailability,
  type Availability,
  type AvailabilityDay,
  type Slot,
} from "../api";
import {
  Banner,
  Body,
  Card,
  Heading,
  Text,
  Title,
  styles as base,
} from "../components";
import {
  addMonths,
  cairoToday,
  dayNumber,
  defaultDay,
  firstDayOfMonth,
  firstOpenDay,
  formatTime,
  lastDayOfMonth,
  longDayLabel,
  monthCells,
  monthLabel,
  monthOf,
  weekdayHeaders,
} from "../dates";
import type { Locale, Strings } from "../i18n";
import { useRefreshHandler } from "../refresh";
import { colors, radius, spacing, touch } from "../theme";

// The calendar screen mirrors the website's month grid (docs/design/views/
// calendar.md): a Saturday-first grid with a free marker, a ring around today
// and the selected day filled with brand, followed by the selected day's slots.

export function CalendarScreen({
  locale,
  t,
  onBook,
  onHome,
  initialDay,
}: {
  locale: Locale;
  t: Strings;
  onBook: (day: string, slot: Slot) => void;
  onHome: () => void;
  initialDay?: string;
}) {
  const [month, setMonth] = useState(monthOf(initialDay ?? cairoToday()));
  const [selected, setSelected] = useState<string | null>(initialDay ?? null);
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (target: string) => {
      setLoading(true);
      setFailed(false);
      const result = await fetchAvailability(
        firstDayOfMonth(target),
        lastDayOfMonth(target),
      );
      setLoading(false);
      if (!result.ok || !result.data) {
        setFailed(true);
        return;
      }
      const next = result.data;
      setData(next);
      setSelected((current) => {
        if (current && monthOf(current) === target) return current;
        if (initialDay && monthOf(initialDay) === target) return initialDay;
        return firstOpenDay(next.days, next.today);
      });
    },
    [initialDay],
  );

  useEffect(() => {
    void load(month);
  }, [load, month]);

  useRefreshHandler(() => load(month));

  function changeMonth(next: string) {
    setLoading(true);
    setMonth(next);
    setSelected(defaultDay(next, data?.today ?? cairoToday()));
  }

  const today = data?.today ?? cairoToday();
  const ready = data !== null && monthOf(data.from) === month;
  const canGoBack = month > monthOf(today);
  const cells = monthCells(month);
  const headers = weekdayHeaders(locale);
  const byDay = new Map((data?.days ?? []).map((entry) => [entry.day, entry]));
  const selectedDay = selected ? byDay.get(selected) : undefined;
  const slots: Slot[] =
    selectedDay && !selectedDay.closed ? selectedDay.slots : [];

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

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.backHome}
        onPress={onHome}
        style={styles.back}
      >
        <Text style={styles.backArrow}>{locale === "ar" ? "→" : "←"}</Text>
        <Text style={styles.backText}>{t.backHome}</Text>
      </Pressable>

      <Title locale={locale}>{t.availability}</Title>
      <Body locale={locale} muted>
        {t.intro}
      </Body>

      {failed && <Banner locale={locale} tone="error" message={t.offline} />}

      {!ready ? (
        loading ? (
          <Body locale={locale} muted>
            {t.sending}
          </Body>
        ) : null
      ) : (
        <>
          <View style={base.card}>
            <View style={styles.monthBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.previousMonth}
                accessibilityState={{ disabled: !canGoBack }}
                disabled={!canGoBack}
                hitSlop={6}
                onPress={() => changeMonth(addMonths(month, -1))}
                style={[
                  styles.monthButton,
                  !canGoBack && styles.monthButtonDisabled,
                ]}
              >
                <Text style={styles.monthButtonText}>
                  {locale === "ar" ? "›" : "‹"}
                </Text>
              </Pressable>

              <Text style={styles.monthLabel}>{monthLabel(month, locale)}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.nextMonth}
                hitSlop={6}
                onPress={() => changeMonth(addMonths(month, 1))}
                style={styles.monthButton}
              >
                <Text style={styles.monthButtonText}>
                  {locale === "ar" ? "‹" : "›"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {headers.map((header) => (
                <Text
                  key={header}
                  numberOfLines={1}
                  style={styles.weekHeaderText}
                >
                  {header}
                </Text>
              ))}
            </View>

            {Array.from({ length: 6 }, (_, week) => (
              <View key={week} style={styles.weekRow}>
                {cells.slice(week * 7, week * 7 + 7).map((day, column) => {
                  if (!day) {
                    return <View key={`empty-${column}`} style={styles.cell} />;
                  }
                  const entry: AvailabilityDay | undefined = byDay.get(day);
                  const past = day < today;
                  const closed = entry?.closed ?? false;
                  const hasFree =
                    entry?.slots.some((slot) => slot.action !== "none") ??
                    false;
                  const isSelected = day === selected;
                  const isToday = day === today;

                  return (
                    <View key={day} style={styles.cell}>
                      <Pressable
                        testID={`day-${day}`}
                        accessibilityRole="button"
                        accessibilityLabel={longDayLabel(day, locale)}
                        accessibilityState={{
                          selected: isSelected,
                          disabled: past,
                        }}
                        disabled={past}
                        hitSlop={6}
                        onPress={() => setSelected(day)}
                        style={[
                          styles.day,
                          isSelected && styles.daySelected,
                          !isSelected && isToday && styles.dayToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                            past && styles.dayTextPast,
                            closed && !isSelected && styles.dayTextClosed,
                          ]}
                        >
                          {dayNumber(day)}
                        </Text>
                        {hasFree && (
                          <View
                            style={[
                              styles.dot,
                              isSelected && styles.dotSelected,
                            ]}
                          />
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>{t.keyFree}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendRing} />
                <Text style={styles.legendText}>{t.keyToday}</Text>
              </View>
              <Text style={[styles.legendText, styles.legendClosed]}>
                {t.keyClosed}
              </Text>
            </View>
          </View>

          <Card>
            {selected && selectedDay && slots.length > 0 ? (
              <>
                <Heading locale={locale}>
                  {longDayLabel(selected, locale)}
                </Heading>
                {slots.map((slot) => {
                  const bookable =
                    slot.action === "book" && slot.state === "free";
                  return (
                    <Pressable
                      key={`${slot.start}-${slot.end}`}
                      disabled={!bookable}
                      onPress={() => onBook(selected, slot)}
                      style={[
                        styles.slot,
                        {
                          backgroundColor: bookable
                            ? colors.accentSoft
                            : colors.bg,
                        },
                      ]}
                    >
                      <Text style={styles.slotTime}>
                        {formatTime(slot.start, locale)} –{" "}
                        {formatTime(slot.end, locale)}
                      </Text>
                      <Text
                        style={[
                          styles.slotState,
                          { color: bookable ? colors.accent : colors.muted },
                        ]}
                      >
                        {bookable ? t.book : stateLabel(slot)}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <>
                {selected && (
                  <Heading locale={locale}>
                    {longDayLabel(selected, locale)}
                  </Heading>
                )}
                <Body locale={locale} muted>
                  {t.noSlots}
                </Body>
              </>
            )}
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    minHeight: touch.minHeight,
  },
  backArrow: { fontSize: 16, color: colors.muted },
  backText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonDisabled: { backgroundColor: "transparent", opacity: 0.35 },
  monthButtonText: { fontSize: 22, lineHeight: 26, color: colors.fg },
  monthLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.fg,
  },
  weekHeader: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: colors.muted,
  },
  weekRow: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center" },
  day: {
    width: "100%",
    maxWidth: 40,
    aspectRatio: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayToday: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  daySelected: { backgroundColor: colors.brand },
  dayText: { fontSize: 15, color: colors.fg },
  dayTextSelected: { color: colors.brandFg, fontWeight: "700" },
  dayTextPast: { color: colors.muted, opacity: 0.55 },
  dayTextClosed: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  dot: {
    position: "absolute",
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  dotSelected: { backgroundColor: colors.brandFg },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  legendRing: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
  legendText: { fontSize: 12, color: colors.muted },
  legendClosed: { textDecorationLine: "line-through" },
  slot: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: touch.minHeight,
  },
  slotTime: { fontSize: 16, color: colors.fg },
  slotState: { fontSize: 14, fontWeight: "600" },
});
