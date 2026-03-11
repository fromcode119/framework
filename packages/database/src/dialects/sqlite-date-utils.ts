export class SqliteDateUtils {
  static toSafeIsoDate(value: Date | null | undefined): string | null {
    if (!value) return null;

    const time = value?.getTime?.();
    if (!Number.isFinite(Number(time))) return null;

    const date = new Date(Number(time));
    const pad = (num: number, size = 2) => String(num).padStart(size, '0');

    return [
      `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
      `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}Z`,
    ].join('T');
  }
}
