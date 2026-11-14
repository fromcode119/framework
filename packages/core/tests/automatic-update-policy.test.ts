import { describe, expect, it } from 'vitest';
import { AutomaticUpdatePolicy } from '@core/management/automatic-update-policy';

const base = { current: '0.2.392', latest: '0.2.395', automatic: true, requested: '', pending: [
  { version: '0.2.395', breaking: false }, { version: '0.2.394', breaking: false }, { version: '0.2.393', breaking: false },
] };

describe('AutomaticUpdatePolicy', () => {
  it('installs the newest release automatically while the switch is on', () => {
    expect(AutomaticUpdatePolicy.decide(base)).toMatchObject({ target: '0.2.395', reason: 'automatic' });
  });

  it('installs nothing on its own while the switch is off', () => {
    expect(AutomaticUpdatePolicy.decide({ ...base, automatic: false })).toMatchObject({ target: '', reason: 'off' });
  });

  it('holds back when a release on the way is marked breaking, naming it', () => {
    const pending = base.pending.map((r) => (r.version === '0.2.394' ? { ...r, breaking: true } : r));
    expect(AutomaticUpdatePolicy.decide({ ...base, pending })).toEqual({ current: '0.2.392', target: '', reason: 'heldBreaking', heldBy: '0.2.394' });
  });

  it('goes ahead with a version an operator asked for, breaking or not, switch on or off', () => {
    const pending = base.pending.map((r) => ({ ...r, breaking: true }));
    expect(AutomaticUpdatePolicy.decide({ ...base, automatic: false, pending, requested: 'v0.2.395' })).toMatchObject({ target: '0.2.395', reason: 'requested' });
  });

  it('ignores a request for the version already running or an older one', () => {
    expect(AutomaticUpdatePolicy.decide({ ...base, automatic: false, requested: '0.2.392' })).toMatchObject({ target: '', reason: 'off' });
  });

  it('does not retry on its own a version that already failed here, but a newer one goes ahead', () => {
    expect(AutomaticUpdatePolicy.decide({ ...base, failed: '0.2.395' })).toMatchObject({ target: '', reason: 'heldFailed', heldBy: '0.2.395' });
    expect(AutomaticUpdatePolicy.decide({ ...base, failed: '0.2.394' })).toMatchObject({ target: '0.2.395', reason: 'automatic' });
    expect(AutomaticUpdatePolicy.decide({ ...base, failed: '0.2.395', requested: '0.2.395' })).toMatchObject({ target: '0.2.395', reason: 'requested' });
  });

  it('does nothing when already on the newest, or when the newest is unknown', () => {
    expect(AutomaticUpdatePolicy.decide({ ...base, latest: '0.2.392' })).toMatchObject({ target: '', reason: 'current' });
    expect(AutomaticUpdatePolicy.decide({ ...base, latest: '' })).toMatchObject({ target: '', reason: 'current' });
  });
  describe('a version held because rolling was not possible', () => {
    const day = new Date('2026-11-14T12:00:00Z');
    const night = new Date('2026-11-15T03:00:00Z');
    const held = { ...base, held: '0.2.395', heldAt: '2026-11-14T11:00:00Z' };

    it('waits during the day, naming the version', () => {
      expect(AutomaticUpdatePolicy.decide({ ...held, now: day })).toEqual({ current: '0.2.392', target: '', reason: 'heldRolling', heldBy: '0.2.395' });
    });

    it('waits even when an operator asked for it with "Update now"', () => {
      expect(AutomaticUpdatePolicy.decide({ ...held, automatic: false, requested: '0.2.395', now: day })).toMatchObject({ target: '', reason: 'heldRolling' });
    });

    it('is tried again at night, at most once an hour', () => {
      expect(AutomaticUpdatePolicy.decide({ ...held, now: night })).toMatchObject({ target: '0.2.395', reason: 'automatic' });
      expect(AutomaticUpdatePolicy.decide({ ...held, heldAt: '2026-11-15T02:30:00Z', now: night })).toMatchObject({ target: '', reason: 'heldRolling' });
    });

    it('goes ahead at once when the operator allowed a restart for it', () => {
      expect(AutomaticUpdatePolicy.decide({ ...held, requested: '0.2.395', restartAllowed: '0.2.395', now: day })).toMatchObject({ target: '0.2.395', reason: 'requested' });
    });

    it('does not hold a newer release than the one held', () => {
      expect(AutomaticUpdatePolicy.decide({ ...held, held: '0.2.394', now: day })).toMatchObject({ target: '0.2.395', reason: 'automatic' });
    });
  });
});
