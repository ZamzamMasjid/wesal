import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import {
  fetchReviewQueue,
  registerDevice,
  signIn,
  staffMe,
  unregisterDevice,
  type ReviewQueueItem,
  type StaffProfile,
} from "../api";
import {
  Banner,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Text,
  Title,
  align,
} from "../components";
import { dayLabel, formatTime } from "../dates";
import type { Locale, Strings } from "../i18n";
import {
  clearDeviceId,
  clearStaffCookie,
  deviceId,
  saveDeviceId,
  saveStaffCookie,
  staffCookie,
} from "../storage";
import { colors, spacing } from "../theme";

export function StaffScreen({
  locale,
  t,
  onBack,
}: {
  locale: Locale;
  t: Strings;
  onBack: () => void;
}) {
  const [cookie, setCookie] = useState<string | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const saved = await staffCookie();
      if (!saved) return;
      const me = await staffMe(saved);
      if (me.ok && me.data) {
        setCookie(saved);
        setProfile(me.data);
        await loadQueue(saved);
      }
    })();
  }, []);

  async function loadQueue(value: string) {
    const result = await fetchReviewQueue(value);
    if (result.ok && result.data) setQueue(result.data.items);
  }

  async function registerPush(value: string) {
    try {
      const projectId = String(
        Constants.expoConfig?.extra?.eas?.projectId ?? "",
      );
      if (projectId === "" || projectId.startsWith("00000000")) {
        setPushNotice(t.pushUnavailable);
        return;
      }
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setPushNotice(t.pushUnavailable);
        return;
      }
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      const registered = await registerDevice(
        value,
        token.data,
        Platform.OS === "ios" ? "ios" : "android",
      );
      if (registered.ok && registered.data) {
        await saveDeviceId(registered.data.id);
        setPushNotice(t.pushReady);
      } else {
        setPushNotice(t.pushUnavailable);
      }
    } catch {
      setPushNotice(t.pushUnavailable);
    }
  }

  async function login() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await signIn(username.trim(), password);
    if (!result.ok || !result.data) {
      setBusy(false);
      setNotice(
        result.error?.code === "RATE_LIMITED" ? t.genericError : t.loginFailed,
      );
      return;
    }
    await saveStaffCookie(result.data.cookie);
    const me = await staffMe(result.data.cookie);
    setBusy(false);
    if (!me.ok || !me.data) {
      setNotice(t.loginFailed);
      return;
    }
    setCookie(result.data.cookie);
    setProfile(me.data);
    await loadQueue(result.data.cookie);
    await registerPush(result.data.cookie);
  }

  async function logout() {
    if (!cookie) return;
    const id = await deviceId();
    if (id !== null) await unregisterDevice(cookie, id);
    await clearDeviceId();
    await clearStaffCookie();
    setCookie(null);
    setProfile(null);
    setQueue([]);
    setPushNotice(null);
    setPassword("");
  }

  if (!cookie || !profile) {
    return (
      <View style={{ gap: spacing.md }}>
        <Title locale={locale}>{t.staffLogin}</Title>
        <Button
          locale={locale}
          variant="ghost"
          label={t.back}
          onPress={onBack}
        />
        <Card>
          {notice && <Banner locale={locale} tone="error" message={notice} />}
          <Field
            locale={locale}
            label={t.username}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Field
            locale={locale}
            label={t.password}
            value={password}
            onChangeText={setPassword}
            secure
          />
          <Button
            locale={locale}
            label={busy ? t.loggingIn : t.login}
            busy={busy}
            onPress={() => void login()}
          />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Title locale={locale}>{profile.name}</Title>
      <Button locale={locale} variant="ghost" label={t.back} onPress={onBack} />

      {pushNotice && (
        <Banner
          locale={locale}
          tone={pushNotice === t.pushReady ? "success" : "error"}
          message={pushNotice}
        />
      )}

      <Card>
        <Heading locale={locale}>{t.reviewQueue}</Heading>
        {queue.length === 0 ? (
          <Body locale={locale} muted>
            {t.reviewEmpty}
          </Body>
        ) : (
          queue.map((item) => (
            <View key={item.bookingId} style={{ gap: 2 }}>
              <Text
                style={[{ color: colors.fg, fontWeight: "600" }, align(locale)]}
              >
                {item.customerName} · {item.bookingId}
              </Text>
              <Text style={[{ color: colors.muted }, align(locale)]}>
                {dayLabel(item.day, locale)} · {formatTime(item.start, locale)}{" "}
                – {formatTime(item.end, locale)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button
        locale={locale}
        variant="danger"
        label={t.logout}
        onPress={() => void logout()}
      />
    </View>
  );
}
