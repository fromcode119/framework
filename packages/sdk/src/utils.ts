/**
 * Converts a Date object to a safe ISO 8601 string in UTC timezone.
 * Returns null for invalid dates, null, undefined, or NaN timestamps.
 * 
 * @param value - Date object to convert
 * @returns ISO 8601 string (YYYY-MM-DDTHH:MM:SS.sssZ) or null
 * 
 * @example
 * toSafeIsoDate(new Date('2024-01-15T10:30:00Z'))
 * // => '2024-01-15T10:30:00.000Z'
 * 
 * toSafeIsoDate(null)
 * // => null
 * 
 * toSafeIsoDate(new Date('invalid'))
 * // => null
 */
export function toSafeIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  const time = value?.getTime?.();
  if (!Number.isFinite(Number(time))) return null;
  const date = new Date(Number(time));
  const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}Z`,
  ].join('T');
}
