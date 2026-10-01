import { describe, expect, it, vi } from 'vitest';
import { IntegrationManager } from '@core/integrations/integration-manager';
import { SettingSource } from '@core/settings/enums/setting-source.enum';

/**
 * An optional integration nobody set up — no AI key on a deployment that does not use AI — logged an
 * ERROR every time a plugin asked whether it was there. Not configuring something optional is not a
 * failure; failing one the operator DID configure is.
 */
describe('IntegrationManager.get for an integration that cannot be created', () => {
  const manager = (source: SettingSource) => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const instance = new IntegrationManager({} as any, '/tmp', logger as any);
    (instance as any).registry = {
      instantiate: async () => { throw new Error('OpenAI API key is required for AI Assistant integration.'); },
      isUnconfigured: async () => source === SettingSource.DEFAULT,
    };
    return { instance, logger };
  };

  it('is quiet when nothing is configured, and still tells the caller it is not there', async () => {
    const { instance, logger } = manager(SettingSource.DEFAULT);
    await expect(instance.get('ai')).rejects.toThrow(/API key is required/);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringMatching(/"ai" is not configured/));
  });

  it('is an error when the operator configured it and it still fails', async () => {
    for (const source of [SettingSource.STORED, SettingSource.ENV]) {
      const { instance, logger } = manager(source);
      await expect(instance.get('ai')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/Failed to get integration "ai"/));
    }
  });
});
