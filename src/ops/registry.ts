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
  ...Object.values(staffOperations),
  ...Object.values(occasionOperations),
  ...Object.values(settingsOperations),
  ...Object.values(scheduleOperations),
  ...Object.values(verificationOperations),
];
