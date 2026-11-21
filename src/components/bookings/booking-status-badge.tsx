import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { AdminBookingStatus } from "@/lib/booking-admin-api";

// A booking's status in the dashboard: a label plus an icon, never colour alone
// (docs/design/system.md). Confirmed is the good outcome here, so it is green;
// rejected and cancelled use the danger tint.

const STYLES: Record<
  AdminBookingStatus,
  { className: string; Icon: LucideIcon }
> = {
  held: { className: "bg-warning-soft text-warning", Icon: Hourglass },
  proof_submitted: { className: "bg-brand-soft text-brand", Icon: Eye },
  confirmed: { className: "bg-success-soft text-success", Icon: CheckCircle2 },
  expired: { className: "bg-fill text-muted", Icon: Clock },
  rejected: { className: "bg-danger-soft text-danger", Icon: XCircle },
  cancelled: { className: "bg-danger-soft text-danger", Icon: Ban },
};

export function BookingStatusBadge({
  status,
  className = "",
}: {
  status: AdminBookingStatus;
  className?: string;
}) {
  const t = useTranslations("Dashboard.bookings.status");
  const { className: style, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${style} ${className}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      {t(status)}
    </span>
  );
}
