import { describe, expect, it } from 'vitest';
import { StepTimer } from '@api/services/system/step-timer';

describe('StepTimer', () => {
  it('reports where the time went only when the whole request was slow', () => {
    let clock = 1_000;
    const timer = new StepTimer(() => clock);
    clock += 10; timer.mark('theme');
    clock += 2_300; timer.mark('adminMetadata');
    clock += 5; timer.mark('site');
    expect(timer.slowReport(2_000)).toBe('2315 ms: theme=10ms adminMetadata=2300ms site=5ms');
    expect(timer.slowReport(5_000)).toBeNull();
  });
});
