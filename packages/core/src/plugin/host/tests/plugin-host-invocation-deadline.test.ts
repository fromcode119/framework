import { describe, expect, it } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';

/**
 * A hook, a settings save or a scheduled run that is still calling the host must not have its token
 * revoked under it: every call after a fixed deadline was refused as `unknown_invocation`, and a large
 * catalogue's card rebuild stopped halfway. Every invocation is held to a deadline on SILENCE.
 */
describe('a plugin invocation deadline', () => {
  const run = async (kind: string) => {
    const seen: Array<{ timeoutMs: number; options: { idle?: boolean } }> = [];
    const channel = {
      isClosed: false,
      request: async (_type: string, _payload: unknown, timeoutMs: number, options: { idle?: boolean }) => {
        seen.push({ timeoutMs, options });
        return undefined;
      },
    };
    const host = {
      slug: 'shop',
      tokens: new PluginInvocationTokens(),
      limits: { timeoutMs: 30000 },
      callbacks: { revive: (value: unknown) => value },
      defaultLocaleFor: () => '',
      peers: () => [],
      enabledPlugins: () => [],
      rememberPeerSignature: () => undefined,
    };
    await (PluginHost.prototype as any).invoke.call(host, { kind }, undefined, channel);
    return seen[0];
  };

  it.each([
    PluginInvocationKind.HOOK.value,
    PluginInvocationKind.SCHEDULER.value,
    PluginInvocationKind.JOB.value,
    PluginInvocationKind.PUBLIC_API.value,
  ])('holds %s work to the per-call deadline on silence, not on total time', async (kind) => {
    expect(await run(String(kind))).toEqual({ timeoutMs: 30000, options: { idle: true } });
  });

  it('keeps the boot window for lifecycle work, also on silence', async () => {
    expect(await run(String(PluginInvocationKind.LIFECYCLE.value))).toEqual({ timeoutMs: PluginHostState.BOOT_TIMEOUT_MS, options: { idle: true } });
  });
});
