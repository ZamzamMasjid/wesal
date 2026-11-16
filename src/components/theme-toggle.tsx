"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  applyTheme,
  otherTheme,
  parseTheme,
  readAppliedTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    // Another tab changed the theme: follow it.
    if (event.key === THEME_STORAGE_KEY) {
      document.documentElement.dataset.theme = parseTheme(event.newValue);
      onChange();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// The server cannot know the visitor's stored theme, so it renders light and the
// client corrects it after hydration.
const getServerSnapshot = (): Theme => "light";

/** Icon button for the site header's tools pill. Shows the theme you would switch to. */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  const theme = useSyncExternalStore(
    subscribe,
    readAppliedTheme,
    getServerSnapshot,
  );
  const next = otherTheme(theme);
  const Icon = next === "dark" ? Moon : Sun;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-(--size-touch-dense) rounded-full text-fg"
      aria-label={next === "dark" ? t("switchToDark") : t("switchToLight")}
      onClick={() => applyTheme(next)}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </Button>
  );
}
