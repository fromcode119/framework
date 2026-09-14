import { describe, expect, it } from 'vitest';
import { SetupStep } from '@/app/setup/enums/setup-step.enum';

/**
 * The wizard advances by `next()` until `isLast`, and only then posts. So the step order is not
 * cosmetic: whichever step is last is the one that submits, and a step added in the wrong place
 * either never shows or steals the submit from the one that should have it.
 */
describe('SetupStep', () => {
  it('ends on the addresses step, which is the one that submits', () => {
    expect(SetupStep.ordered.map((step) => step.value)).toEqual(['language', 'account', 'platform', 'addresses']);
    expect(SetupStep.ADDRESSES.isLast).toBe(true);
    expect(SetupStep.PLATFORM.isLast).toBe(false);
  });

  it('walks forward to it and back again without leaving the wizard', () => {
    expect(SetupStep.LANGUAGE.next().next().next()).toBe(SetupStep.ADDRESSES);
    // Clamped at both ends: neither button can walk off.
    expect(SetupStep.ADDRESSES.next()).toBe(SetupStep.ADDRESSES);
    expect(SetupStep.LANGUAGE.previous()).toBe(SetupStep.LANGUAGE);
    expect(SetupStep.ADDRESSES.previous()).toBe(SetupStep.PLATFORM);
  });

  it('keeps language first, so the wizard can be read before anything is typed', () => {
    expect(SetupStep.LANGUAGE.isFirst).toBe(true);
  });
});
