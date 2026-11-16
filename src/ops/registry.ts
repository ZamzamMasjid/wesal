import { getHealth } from "./health";
import { staffOperations } from "./staff/staff";

import type { Operation } from "@/api/operation";

// Every operation the API exposes. The guard test walks this list, so a new
// operation must be added here (and gets the access checks for free).
export const operations: Operation<unknown>[] = [
  getHealth,
  ...Object.values(staffOperations),
];
