import { describe, it, expect } from 'vitest';
import { PluginPreflightCommandService } from '@cli/services/plugin-preflight-command-service';

describe('PluginPreflightCommandService.exitCodeFor', () => {
  it('0 when report ok', () => {
    expect(PluginPreflightCommandService.exitCodeFor({ ok: true } as any)).toBe(0);
  });
  it('1 when report not ok', () => {
    expect(PluginPreflightCommandService.exitCodeFor({ ok: false } as any)).toBe(1);
  });
});
