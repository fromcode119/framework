import { ExtensionScope } from '@fromcode119/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PackageBuilder } from '@sources/packaging/package-builder';

/**
 * An appearance repository commits no build output — `dist/` is ignored in every one of them — so
 * Sources has to BUILD it. It used to copy the source as-is and report success, and production ended
 * up with appearances that had no `bundle.js`: every workspace domain showed the default sign-in, and
 * the design never loaded behind it.
 */
describe('PackageBuilder — appearances', () => {
  const dirs: string[] = [];
  const temp = (prefix: string): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  const appearanceSource = (): string => {
    const dir = temp('appearance-src-');
    fs.writeFileSync(path.join(dir, 'appearance.json'), JSON.stringify({ slug: 'lagoon', name: 'Lagoon', version: '0.2.0' }));
    fs.writeFileSync(path.join(dir, 'index.ts'), "export const lagoonRegistered: string = 'lagoon';\n");
    fs.writeFileSync(path.join(dir, 'styles.less'), '@ink: #102030;\n.lagoon { color: @ink; }\n');
    return dir;
  };

  it('stages a built appearance: bundle and stylesheet present, source stripped', async () => {
    const out = temp('appearance-out-');
    const builder = new PackageBuilder(path.join(out, 'plugins'), path.join(out, 'themes'), path.join(out, 'core'), path.join(out, 'appearances'));

    const result = await builder.build(appearanceSource(), ExtensionScope.APPEARANCE);

    expect(result.slug).toBe('lagoon');
    expect(result.version).toBe('0.2.0');
    const staged = result.stagedDir as string;
    expect(fs.readFileSync(path.join(staged, 'dist', 'bundle.js'), 'utf8')).toContain('lagoon');
    expect(fs.readFileSync(path.join(staged, 'dist', 'appearance.css'), 'utf8')).toContain('#102030');
    expect(fs.existsSync(path.join(staged, 'index.ts'))).toBe(false);
    expect(fs.existsSync(path.join(staged, 'appearance.json'))).toBe(true);
  }, 60_000);
});
