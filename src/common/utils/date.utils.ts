/**
 * Date Utilities for ZATCA Compliance
 *
 * ZATCA requires all dates and times to be strictly strictly local to Saudi Arabia (Asia/Riyadh).
 * Using standard `new Date()` on a server hosted in US/Europe will result in incorrect dates
 * during late-night hours in Saudi Arabia.
 */

export const TIMEZONE = "Asia/Riyadh";

/**
 * Returns the current date in 'YYYY-MM-DD' format, strictly for the given timezone.
 *
 * @param timezone IANA timezone (default: Asia/Riyadh)
 * @returns {string} e.g. "2025-12-26"
 */
export function getZatcaDate(timezone: string = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns the current time in 'HH:mm:ss' format, strictly for the given timezone.
 * Used for <cbc:IssueTime>.
 *
 * @param timezone IANA timezone (default: Asia/Riyadh)
 * @returns {string} e.g. "14:30:00"
 */
export function getZatcaTime(timezone: string = TIMEZONE): string {
  // en-GB uses 24-hour format (HH:mm:ss) which matches ZATCA requirements
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Force 24-hour format
  }).format(new Date());
}
