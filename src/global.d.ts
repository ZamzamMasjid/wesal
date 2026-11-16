import type { Locale } from "@/i18n/routing";
import type ar from "../messages/ar.json";

// Types next-intl's t() keys and locale values. Arabic is the source catalog;
// src/i18n/catalog-parity.ts guarantees English matches it.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof ar;
  }
}
