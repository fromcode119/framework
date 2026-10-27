import { describe, expect, it, vi } from 'vitest';
import { PluginPeerRegistration } from '../src/plugin-peer-registration';

/** A revoked token as the guest sees it: a revived plain Error that kept only the code. */
const revoked = () => Object.assign(new Error('unknown_invocation: plugin "alpha" presented a token the host did not mint'), { code: 'unknown_invocation' });

function setup(register: (peer: unknown) => Promise<void>) {
  const logger = { info: vi.fn(), warn: vi.fn() };
  const context = {
    plugin: { slug: 'alpha' },
    logger,
    api: { use: vi.fn() },
    plugins: { on: vi.fn(), namespace: () => ({ beta: {} }) },
  };
  const registration = PluginPeerRegistration.install(context, { namespace: 'org.test', peerSlug: 'beta', label: 'provider', register });
  return { registration, logger };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PluginPeerRegistration', () => {
  it('does not report a boot attempt that outlived onInit as a failure, and registers on the next moment', async () => {
    const register = vi.fn().mockRejectedValueOnce(revoked()).mockResolvedValue(undefined);
    const { registration, logger } = setup(register);
    await flush();
    expect(logger.warn).not.toHaveBeenCalled();
    await expect(registration.attempt('plugins:ready')).resolves.toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('(plugins:ready)'));
  });

  it('still reports the same code at a moment its invocation awaits', async () => {
    const register = vi.fn().mockResolvedValueOnce(undefined);
    const { registration, logger } = setup(register);
    await flush();
    register.mockRejectedValueOnce(revoked());
    await expect(registration.attempt('plugins:ready')).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('failed (plugins:ready)'));
  });

  it('still reports a real failure at boot', async () => {
    const { logger } = setup(vi.fn().mockRejectedValue(new Error('peer threw')));
    await flush();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('peer threw'));
  });
});
