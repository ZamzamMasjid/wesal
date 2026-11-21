import { bookingOperations } from "./booking/hold";
import { proofOperations } from "./booking/proof";
import { bookingReadOperations } from "./booking/read";
import { reviewOperations } from "./booking/review";
import { calendarOperations } from "./calendar/availability";
import { getHealth } from "./health";
import { twilioStatusOperation } from "./messaging/twilio-status";
import { staffOperations } from "./staff/staff";
import { scheduleOperations } from "./schedule/schedule";
import { occasionOperations } from "./venue/occasions";
import { settingsOperations } from "./venue/settings";
import { verificationOperations } from "./verification/verification";

import type { Operation } from "@/api/operation";

// Every operation the API exposes. The guard test walks this list, so a new
// operation must be added here (and gets the access checks for free).
export const operations: Operation<unknown>[] = [
  getHealth,
  twilioStatusOperation,
  ...Object.values(bookingOperations),
  ...Object.values(proofOperations),
  ...Object.values(bookingReadOperations),
  ...Object.values(reviewOperations),
  ...Object.values(calendarOperations),
  ...Object.values(staffOperations),
  ...Object.values(occasionOperations),
  ...Object.values(settingsOperations),
  ...Object.values(scheduleOperations),
  ...Object.values(verificationOperations),
];
