/** Human forms for the process card: sizes in MB, durations in the largest two units. */
export class PluginProcessFormat {
  static megabytes(bytes: number): string {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  static duration(seconds: number): string {
    const units: Array<[string, number]> = [['d', 86_400], ['h', 3_600], ['min', 60], ['s', 1]];
    const parts: string[] = [];
    let rest = Math.max(0, Math.round(seconds));
    for (const [label, size] of units) {
      const count = Math.floor(rest / size);
      rest -= count * size;
      if (count > 0 || (label === 's' && parts.length === 0)) parts.push(`${count} ${label}`);
      if (parts.length === 2) break;
    }
    return parts.join(' ');
  }
}
