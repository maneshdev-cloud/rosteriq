// Demand: how many staff a brand-process needs on a date.

import type { BrandProcess, CoverageRule, Holiday } from "../types";
import { isOperatingDay } from "./calendar";

/** Required headcount for a brand-process on a date: 0 when the process
 *  calendar is closed, otherwise the base min_staff or the date override
 *  (e.g. a sale day needing 2 people on one process). */
export function requiredStaff(
  bp: BrandProcess,
  rule: CoverageRule | undefined,
  iso: string,
  holidays: Holiday[],
): number {
  if (!isOperatingDay(bp, iso, holidays)) return 0;
  if (!rule) return 0;
  return rule.overrides?.[iso] ?? rule.minStaff;
}
