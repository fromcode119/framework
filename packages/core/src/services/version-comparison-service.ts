export class VersionComparisonService {
  static isGreater(left: string | null | undefined, right: string | null | undefined): boolean {
    const comparison = VersionComparisonService.compare(left, right);
    return comparison > 0;
  }

  /**
   * The row with the highest version, compared numerically ("1.2.35" above "1.2.6"). A catalogue may
   * list several versions of one extension; its first row is not its newest.
   */
  static newest<T extends { version?: unknown }>(rows: readonly T[]): T | undefined {
    let best: T | undefined;
    for (const row of rows) {
      if (!best || VersionComparisonService.isGreater(String(row?.version ?? ''), String(best.version ?? ''))) best = row;
    }
    return best;
  }

  static isSame(left: string | null | undefined, right: string | null | undefined): boolean {
    return VersionComparisonService.compare(left, right) === 0;
  }

  private static compare(left: string | null | undefined, right: string | null | undefined): number {
    const normalizedLeft = VersionComparisonService.normalize(left);
    const normalizedRight = VersionComparisonService.normalize(right);

    if (!normalizedLeft && !normalizedRight) {
      return 0;
    }

    if (!normalizedLeft) {
      return -1;
    }

    if (!normalizedRight) {
      return 1;
    }

    const leftParts = normalizedLeft.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = normalizedRight.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;
      if (leftPart > rightPart) {
        return 1;
      }
      if (leftPart < rightPart) {
        return -1;
      }
    }

    return 0;
  }

  private static normalize(version: string | null | undefined): string {
    return String(version || '')
      .trim()
      .replace(/^v/i, '')
      .replace(/[^0-9.].*$/, '');
  }
}
