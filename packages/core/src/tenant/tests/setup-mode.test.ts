import { afterEach, describe, expect, it } from 'vitest';
import { SetupMode } from '@core/tenant/setup-mode';

/**
 * Setup mode is the ONE exception to the platform's fail-closed rule for an unrecognised host, so
 * what matters is the shape of the exception: how narrowly it opens, and that it cannot be reopened.
 */
describe('SetupMode', () => {
  let clock = 0;
  const at = (ms: number) => { clock = ms; };
  const fresh = { userCount: 0, tenantCount: 0, adminHostConfigured: false, setupCompleted: false };

  afterEach(() => {
    SetupMode.reset();
  });

  const configure = (input: Partial<typeof fresh> = {}) => {
    clock = 0;
    SetupMode.reset(() => clock);
    SetupMode.configure({ ...fresh, ...input });
  };

  it('opens only for a deployment with none of the four signals', () => {
    configure();
    expect(SetupMode.isActive()).toBe(true);
  });

  it.each([
    ['a user already exists', { userCount: 1 }],
    ['a tenant already exists', { tenantCount: 1 }],
    ['the admin domain is already known', { adminHostConfigured: true }],
    ['setup was completed before', { setupCompleted: true }],
  ])('stays SHUT when %s', (_label, input) => {
    configure(input);
    expect(SetupMode.isActive()).toBe(false);
  });

  it('closes on its own once the window passes, so a forgotten box does not sit open', () => {
    configure();
    at(SetupMode.WINDOW_MS - 1);
    expect(SetupMode.isActive()).toBe(true);

    at(SetupMode.WINDOW_MS + 1);
    expect(SetupMode.isActive()).toBe(false);
    expect(SetupMode.unavailableReason()).toBe('expired');
  });

  it('gives the install to the FIRST claimant and refuses a second party', () => {
    configure();

    expect(SetupMode.claim('first')).toBe(true);
    expect(SetupMode.claim('first')).toBe(true); // the same party may continue
    expect(SetupMode.claim('second')).toBe(false);
    expect(SetupMode.isClaimedByOther('second')).toBe(true);
    expect(SetupMode.isClaimedByOther('first')).toBe(false);
  });

  it('refuses a claim once the window has passed', () => {
    configure();
    at(SetupMode.WINDOW_MS + 1);

    expect(SetupMode.claim('late')).toBe(false);
  });

  it('cannot be reopened by completing and then re-checking', () => {
    configure();
    SetupMode.complete();

    expect(SetupMode.isActive()).toBe(false);
    expect(SetupMode.unavailableReason()).toBe('completed');
    // Nothing short of configure() — i.e. a restart reading an empty database — brings it back.
    expect(SetupMode.claim('anyone')).toBe(false);
  });

  it('does not reopen when only ONE signal is cleared, which is what a deleted table looks like', () => {
    // Users deleted, but the admin domain is still configured: this is an existing install
    // someone emptied a table in, not a fresh one.
    configure({ userCount: 0, adminHostConfigured: true });
    expect(SetupMode.isActive()).toBe(false);
  });
});
