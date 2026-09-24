import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HardcodedCopyGuard } from '../src/hardcoded-copy-guard';

/**
 * `seeds/**` is waived because seed content is initial DATA that becomes editable records. A plugin's
 * `seed.ts` — the entry the framework's seeder loads — is the same data in one file (a currency's own
 * symbol, "лв" for BGN), so it is waived the same way. Render and service code is still scanned.
 */
describe('HardcodedCopyGuard and the seeder entry', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  const plugin = (files: Record<string, string>): string => {
    root = mkdtempSync(path.join(tmpdir(), 'hardcoded-copy-'));
    const dir = path.join(root, 'plugins', 'demo');
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), body);
    }
    return dir;
  };

  it('does not count the seed data in seed.ts', () => {
    const dir = plugin({ 'seed.ts': "export class DemoSeed { static rows = [{ symbol: 'лв' }]; }\n" });
    expect(HardcodedCopyGuard.scan([{ area: 'plugins', dir }]).counts.plugins).toBe(0);
  });

  it('still counts copy in source files beside it', () => {
    const dir = plugin({
      'seed.ts': "export class DemoSeed { static rows = [{ symbol: 'лв' }]; }\n",
      'src/demo-service.ts': "export class DemoService { label = 'Комисиона'; }\n",
    });
    const result = HardcodedCopyGuard.scan([{ area: 'plugins', dir }]);
    expect(result.counts.plugins).toBe(1);
    expect(result.detail.map((d) => path.basename(d.file))).toEqual(['demo-service.ts']);
  });
});
