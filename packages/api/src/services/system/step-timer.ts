/**
 * Times the steps of one request, for a report only when the whole of it was slow.
 *
 * `mark(name)` closes the step that ran since the previous mark. A request under the threshold says
 * nothing, so the log carries only the slow ones, each with where its time went.
 */
export class StepTimer {
  private readonly started: number;
  private last: number;
  private readonly steps: string[] = [];

  /** `onMark` is told each closed step as it closes — how a request's steps reach its `Server-Timing`. */
  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly onMark?: (name: string, ms: number) => void,
  ) {
    this.started = now();
    this.last = this.started;
  }

  mark(name: string): void {
    const at = this.now();
    this.steps.push(`${name}=${Math.round(at - this.last)}ms`);
    this.onMark?.(name, at - this.last);
    this.last = at;
  }

  /** `2380 ms: theme=12ms admin=2301ms …` once the total reached `thresholdMs`; otherwise null. */
  slowReport(thresholdMs: number): string | null {
    const total = this.now() - this.started;
    return total >= thresholdMs ? `${Math.round(total)} ms: ${this.steps.join(' ')}` : null;
  }
}
