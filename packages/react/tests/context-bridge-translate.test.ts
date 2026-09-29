import { afterEach, describe, expect, it } from 'vitest';
import { ContextBridge } from '@react/context-bridge';
import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';

/**
 * `ContextBridge.t` is what copy outside a component (an option list, a lazy-loader fallback) reads.
 * The provider installs the bridge from an effect, so a render can reach it first.
 */
describe('ContextBridge.t', () => {
  afterEach(() => ContextBridge.install(null as unknown as IRuntimeBridgeInstallArgs));

  it('answers the default text before the bridge is installed, then the key', () => {
    ContextBridge.install(null as unknown as IRuntimeBridgeInstallArgs);
    expect(ContextBridge.t('shop.ui.none', {}, '— none —')).toBe('— none —');
    expect(ContextBridge.t('shop.ui.none')).toBe('shop.ui.none');
  });

  it('asks the installed translator once there is one', () => {
    ContextBridge.install({ stableT: (key: string, _params: unknown, fallback: string) => (key === 'shop.ui.none' ? '— няма —' : fallback) } as unknown as IRuntimeBridgeInstallArgs);
    expect(ContextBridge.t('shop.ui.none', {}, '— none —')).toBe('— няма —');
  });
});
