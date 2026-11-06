/**
 * How long each step of one storefront document render took, sent back as a `Server-Timing` header.
 *
 * A slow page answers "where did the time go?" in the browser's own network panel, on any site and
 * in production, without a profiler or a log line. Only durations and fixed step names are sent —
 * nothing about the visitor or the content.
 */
export class DocumentRenderTiming {
  private readonly started = performance.now();
  private readonly steps: Array<{ name: string; ms: number }> = [];

  /** Times one awaited step and passes its value through. */
  async measure<T>(name: string, work: Promise<T>): Promise<T> {
    const begun = performance.now();
    try {
      return await work;
    } finally {
      this.steps.push({ name, ms: performance.now() - begun });
    }
  }

  /** Times one synchronous step. */
  measureSync<T>(name: string, work: () => T): T {
    const begun = performance.now();
    try {
      return work();
    } finally {
      this.steps.push({ name, ms: performance.now() - begun });
    }
  }

  header(): string {
    const parts = this.steps.map((step) => `${step.name};dur=${step.ms.toFixed(1)}`);
    parts.push(`total;dur=${(performance.now() - this.started).toFixed(1)}`);
    return parts.join(', ');
  }
}
