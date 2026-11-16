"use client";

import { ServiceNotice } from "@/components/service-notice";

// Any page that throws (typically because postgres is down) lands here.
export default function LocaleError({ reset }: { reset: () => void }) {
  return <ServiceNotice onRetry={reset} />;
}
