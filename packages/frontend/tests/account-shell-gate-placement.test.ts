import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A STRUCTURAL guard, deliberately.
 *
 * The bug was not that the auth gate was wrong — `AccountAuthGate` worked. It was that the gate sat
 * inside `AccountShellDefault`, the one component the `account.shell` override exists to REPLACE. A
 * theme registered its own shell, the gate went with the layout, and the entire account rendered to
 * signed-out visitors. Nothing about that is visible in a behavioural test of either component in
 * isolation: each is individually correct.
 *
 * What has to stay true is the PLACEMENT — the gate belongs to the surface, above the override, where
 * a replacement cannot reach it. That is what this pins.
 *
 * (`packages/react` has no vitest project, so this lives with the frontend suite and reads the source
 * directly rather than adding a test project for two assertions.)
 */
describe('account shell auth gate placement', () => {
  const read = (relative: string) =>
    readFileSync(new URL(`../../react/src/${relative}`, import.meta.url), 'utf8');

  it('gates the override surface, so a theme shell cannot opt out of authentication', () => {
    const surface = read('account-shell.tsx');
    expect(surface).toContain('AccountAuthGate');
    // The gate must WRAP the override, not sit beside it.
    const gateOpensBeforeOverride = surface.indexOf('<AccountAuthGate>') < surface.indexOf('<Override');
    expect(gateOpensBeforeOverride).toBe(true);
    expect(surface).toContain('</AccountAuthGate>');
  });

  it('does not gate inside the replaceable default shell', () => {
    expect(read('account/account-shell-default.tsx')).not.toContain('AccountAuthGate');
  });
});
