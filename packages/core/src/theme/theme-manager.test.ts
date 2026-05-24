import { describe, expect, it, vi } from 'vitest';
import { ThemeManager } from './theme-manager';
import { PluginDefaultPageMaterializationRuntimeService } from '../services/default-page-contract/plugin-default-page-materialization-runtime-service';

describe('ThemeManager', () => {
  it('reconciles default pages after loading the active theme on startup', async () => {
    const db = {
      findOne: vi.fn(async () => ({ slug: 'alpha', state: 'active' })),
    };
    const subject = new ThemeManager(db as any, {});
    const materializeSpy = vi.spyOn(subject as any, 'materializeDefaultPages').mockResolvedValue(undefined);

    await (subject as any).loadActiveTheme();

    expect(db.findOne).toHaveBeenCalledWith('_system_themes', { state: 'active' });
    expect(materializeSpy).toHaveBeenCalledTimes(1);
  });

  it('rethrows required-route reconciliation failures during theme activation reconciliation', async () => {
    const db = {
      findOne: vi.fn(async (...args: any[]) => {
        if (args[1]?.slug === 'alpha') {
          return { slug: 'alpha', state: 'inactive' };
        }

        return null;
      }),
      insert: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
    };
    const subject = new ThemeManager(db as any, {});
    (subject as any).themes.set('alpha', { slug: 'alpha', name: 'Alpha', version: '1.0.0' });
    vi.spyOn(subject as any, 'materializeDefaultPages').mockRejectedValue(
      new Error('[PluginDefaultPageMaterializationRuntimeService] Required route reconciliation failed: org.synthetic:catalog-module:catalog-index (install-disabled, contract-not-ready)'),
    );

    await expect(subject.activateTheme('alpha')).rejects.toThrow('Required route reconciliation failed');
  });
});