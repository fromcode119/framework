import { performance } from 'perf_hooks';
import type { IRequestTimingStepTotal } from '@core/context/interfaces/request-timing-step-total.interface';

/** What one request records: when it began, and the time each named step took. */
export class RequestTimingRecorder {
  readonly began = performance.now();
  readonly steps = new Map<string, IRequestTimingStepTotal>();
  handlerReached = false;

  add(name: string, ms: number): void {
    const total = this.steps.get(name) ?? { ms: 0, count: 0 };
    total.ms += ms;
    total.count += 1;
    this.steps.set(name, total);
  }
}
