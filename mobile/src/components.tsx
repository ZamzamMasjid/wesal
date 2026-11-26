import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamilyFor } from "./fonts";
import type { Locale } from "./i18n";
import { colors, radius, shadow, spacing, touch } from "./theme";

export function direction(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function align(locale: Locale) {
  return { textAlign: locale === "ar" ? "right" : "left" } as const;
}

/**
 * Every label in the app goes through here so it picks up Cairo. The static
 * face is chosen from the style's weight, then the weight is reset so Android
 * does not fake-bold a face that is already bold.
 */
export function Text({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  return (
    <NativeText
      {...props}
      style={[
        style,
        { fontFamily: fontFamilyFor(weight), fontWeight: "normal" },
      ]}
    />
  );
}

export function Screen({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
  // Kept in the signature so every screen names its direction the same way.
  locale: Locale;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  return <Text style={[styles.title, align(locale)]}>{children}</Text>;
}

export function Heading({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  return <Text style={[styles.heading, align(locale)]}>{children}</Text>;
}

export function Body({
  children,
  locale,
  muted,
}: {
  children: ReactNode;
  locale: Locale;
  muted?: boolean;
}) {
  return (
    <Text
      style={[styles.body, muted && { color: colors.muted }, align(locale)]}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  busy,
  disabled,
  locale,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
  locale: Locale;
}) {
  const palette = {
    primary: { background: colors.brand, text: colors.brandFg },
    secondary: { background: colors.fill, text: colors.fg },
    ghost: { background: "transparent", text: colors.brand },
    danger: { background: colors.dangerSoft, text: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text
          style={[styles.buttonText, { color: palette.text }, align(locale)]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  locale,
  keyboardType,
  secure,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  locale: Locale;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  secure?: boolean;
  placeholder?: string;
  autoCapitalize?: "none" | "words";
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, align(locale)]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            textAlign: locale === "ar" ? "right" : "left",
            writingDirection: locale === "ar" ? "rtl" : "ltr",
          },
        ]}
      />
    </View>
  );
}

export function Banner({
  message,
  tone = "info",
  locale,
}: {
  message: string;
  tone?: "info" | "error" | "success";
  locale: Locale;
}) {
  const palette = {
    info: { background: colors.fill, text: colors.fg },
    error: { background: colors.dangerSoft, text: colors.danger },
    success: { background: colors.successSoft, text: colors.success },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.background }]}>
      <Text style={[styles.bannerText, { color: palette.text }, align(locale)]}>
        {message}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  row: { flexDirection: "row" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.fg,
    marginTop: spacing.sm,
  },
  heading: { fontSize: 20, fontWeight: "700", color: colors.fg },
  body: { fontSize: 16, lineHeight: 24, color: colors.fg },
  button: {
    minHeight: touch.minHeight,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "500", color: colors.fg },
  input: {
    minHeight: touch.minHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.fg,
    fontFamily: "Cairo_400Regular",
  },
  banner: { borderRadius: radius.md, padding: spacing.md },
  bannerText: { fontSize: 14 },
});
