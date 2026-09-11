/**
 * Bytes as an operator reads them: 2.1 GB, 412 MB, 0 B.
 *
 * Binary units (1024), matching what `df`, Docker and the OS report — a dashboard that prints 2.3 GB
 * beside a `df` saying 2.1 GiB invites the reader to distrust both. One decimal above kilobytes,
 * none below, because a tenth of a byte is noise.
 */
export class ByteSizeFormatter {
  private static readonly UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  private static readonly STEP = 1024;

  static format(bytes: number | null | undefined): string {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value < ByteSizeFormatter.STEP) return `${Math.round(value)} B`;

    let scaled = value;
    let unit = 0;
    while (scaled >= ByteSizeFormatter.STEP && unit < ByteSizeFormatter.UNITS.length - 1) {
      scaled /= ByteSizeFormatter.STEP;
      unit += 1;
    }
    return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${ByteSizeFormatter.UNITS[unit]}`;
  }
}
