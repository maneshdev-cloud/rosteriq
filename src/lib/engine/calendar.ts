// Calendar logic: pure date functions + brand-process operating calendars.
// All dates are ISO strings (yyyy-mm-dd) interpreted in plain calendar terms —
// no time-of-day, no timezones, no shift windows anywhere in the engine.

import type { BrandProcess, Holiday } from "../types";

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** 0 = Sunday .. 6 = Saturday */
export function weekday(iso: string): number {
  return parseDate(iso).getUTCDay();
}

/** All ISO dates of a month given as "yyyy-mm". */
export function datesOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) =>
    toISO(new Date(Date.UTC(y, m - 1, i + 1))),
  );
}

/** Monday-start calendar weeks covering the month; each week is 7 ISO dates
 *  (may reach into the neighbouring months). */
export function weeksOfMonth(month: string): string[][] {
  const dates = datesOfMonth(month);
  const first = dates[0];
  // step back to the Monday of the first week
  const offset = (weekday(first) + 6) % 7;
  let cursor = addDays(first, -offset);
  const weeks: string[][] = [];
  const last = dates[dates.length - 1];
  while (cursor <= last) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function isHoliday(iso: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === iso);
}

/** Does this brand-process owe coverage on this date? The calendar lives on
 *  the brand-process, NOT on the brand and NOT on the employee. */
export function isOperatingDay(
  bp: BrandProcess,
  iso: string,
  holidays: Holiday[],
): boolean {
  switch (bp.calendarType) {
    case "ALL_365":
      return true;
    case "DAILY_EXCEPT_HOLIDAYS":
      return !isHoliday(iso, holidays);
    case "SUN_AND_HOLIDAYS_OFF":
      return weekday(iso) !== 0 && !isHoliday(iso, holidays);
  }
}
