/** How released tags (`v1.2.3`) are told from other tags and put in order. */
export class StackReleaseOrder {
  private static readonly RELEASE = /^v?\d+\.\d+\.\d+$/;

  /** Only the release tags among these, newest first, each once. */
  static releases(tags: readonly string[]): string[] {
    return [...new Set(tags.filter((tag) => StackReleaseOrder.RELEASE.test(tag)))].sort(StackReleaseOrder.newestFirst);
  }

  private static newestFirst(a: string, b: string): number {
    const parts = (tag: string) => tag.replace(/^v/, '').split('.').map(Number);
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return y[i] - x[i];
    return 0;
  }
}
