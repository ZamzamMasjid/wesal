import { useFonts } from "expo-font";
import * as Localization from "expo-localization";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { fetchOccasions, type Occasion, type Slot } from "./src/api";
import { Text, direction } from "./src/components";
import { fontAssets } from "./src/fonts";
import { text, type Locale } from "./src/i18n";
import { BookingFormScreen } from "./src/screens/BookingFormScreen";
import { BookingScreen } from "./src/screens/BookingScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { StaffScreen } from "./src/screens/StaffScreen";
import { saveLocale, savedLocale } from "./src/storage";
import { colors, radius, spacing } from "./src/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type Route =
  | { name: "home" }
  | { name: "calendar" }
  | { name: "book"; day: string; slot: Slot }
  | { name: "booking"; token: string | null }
  | { name: "staff" };

function deviceLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode ?? "ar";
  return code === "en" ? "en" : "ar";
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(deviceLocale());
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const t = text(locale);

  useEffect(() => {
    void (async () => {
      const stored = await savedLocale();
      if (stored) setLocale(stored);
      const result = await fetchOccasions();
      if (result.ok && result.data) setOccasions(result.data.occasions);
    })();
  }, []);

  useEffect(() => {
    void saveLocale(locale);
  }, [locale]);

  function switchLocale() {
    setLocale((current) => (current === "ar" ? "en" : "ar"));
  }

  function openBooking(token: string | null) {
    if (token) setLastToken(token);
    setRoute({ name: "booking", token: token ?? lastToken });
  }

  if (!fontsLoaded && !fontError) {
    return <View style={styles.root} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.root, { direction: direction(locale) }]}
        testID="app-root"
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.brand}>{t.appName}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.language}
            onPress={switchLocale}
            style={styles.language}
          >
            <Text style={styles.languageText}>{t.language}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {route.name === "home" && (
              <HomeScreen
                locale={locale}
                t={t}
                onCalendar={() => setRoute({ name: "calendar" })}
                onBooking={(token) => openBooking(token)}
                onStaff={() => setRoute({ name: "staff" })}
              />
            )}
            {route.name === "calendar" && (
              <CalendarScreen
                locale={locale}
                t={t}
                onBook={(day, slot) => setRoute({ name: "book", day, slot })}
              />
            )}
            {route.name === "book" && (
              <BookingFormScreen
                locale={locale}
                t={t}
                day={route.day}
                start={route.slot.start}
                end={route.slot.end}
                occasions={occasions}
                onHeld={(token) => openBooking(token)}
                onBack={() => setRoute({ name: "calendar" })}
                onCalendar={() => setRoute({ name: "calendar" })}
              />
            )}
            {route.name === "booking" && (
              <BookingScreen
                locale={locale}
                t={t}
                token={route.token}
                onBack={() => setRoute({ name: "home" })}
              />
            )}
            {route.name === "staff" && (
              <StaffScreen
                locale={locale}
                t={t}
                onBack={() => setRoute({ name: "home" })}
              />
            )}
          </ScrollView>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(
            [
              ["home", t.home, { name: "home" } as Route],
              ["calendar", t.calendar, { name: "calendar" } as Route],
              [
                "booking",
                t.booking,
                { name: "booking", token: lastToken } as Route,
              ],
            ] as const
          ).map(([key, label, target]) => {
            const active = route.name === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setRoute(target)}
                style={styles.tab}
              >
                <Text style={[styles.tabText, active && styles.tabActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
  },
  brand: { fontSize: 22, fontWeight: "800", color: colors.brand },
  language: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  languageText: { color: colors.fg, fontWeight: "600" },
  content: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  tabActive: { color: colors.brand },
});
