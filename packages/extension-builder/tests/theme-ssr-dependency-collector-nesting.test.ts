import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSsrDependencyCollector } from '@extension-builder/pack/theme-ssr-dependency-collector';

/**
 * Resolving a dependency npm NESTED instead of hoisting.
 *
 * npm nests a package when two dependents need different versions of it, so a nested copy is a
 * normal install, not a broken one. The collector searched only upward from the theme root, which
 * is half of Node's algorithm — the half that starts at the importer was missing — so a correctly
 * installed `yaml` under `cosmiconfig/node_modules` was reported missing and failed the pack with
 * "Run npm install in the theme", which would never have fixed it.
 */
describe('ThemeSsrDependencyCollector — dependencies npm nested', () => {
  let root: string;
  let themeDir: string;
  let packDir: string;

  const writePackage = (dir: string, manifest: Record<string, unknown>): void => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0', ...manifest }));
    fs.writeFileSync(path.join(dir, 'index.js'), '// content');
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssr-deps-'));
    themeDir = path.join(root, 'theme');
    packDir = path.join(root, 'pack');

    // The server bundle imports one package by name.
    fs.mkdirSync(path.join(themeDir, 'ui-ssr'), { recursive: true });
    fs.writeFileSync(
      path.join(themeDir, 'ui-ssr', 'entry.mjs'),
      "import { cosmiconfig } from 'cosmiconfig';\nexport default cosmiconfig;\n",
    );

    // cosmiconfig needs yaml, and npm put yaml INSIDE it — the shape that broke the build.
    const cosmiconfig = path.join(themeDir, 'node_modules', 'cosmiconfig');
    writePackage(cosmiconfig, { name: 'cosmiconfig', dependencies: { yaml: '^1.10.0' } });
    writePackage(path.join(cosmiconfig, 'node_modules', 'yaml'), { name: 'yaml', version: '1.10.2' });

    // NOTHING is hoisted. This is the shape that actually failed: `yaml` exists only inside
    // cosmiconfig, so a lookup that starts at the theme root finds nothing and calls a correct
    // install broken. A fixture with a hoisted copy as well would pass either way and prove nothing.
  });

  /**
   * The other real shape: the BUNDLE needs yaml too, and npm hoisted a different major for it.
   *
   * Both copies are then genuinely required — that is why npm nested one — and both must arrive.
   */
  const alsoNeedADifferentYamlInTheBundle = (): void => {
    writePackage(path.join(themeDir, 'node_modules', 'yaml'), { name: 'yaml', version: '2.4.0' });
    fs.writeFileSync(
      path.join(themeDir, 'ui-ssr', 'entry.mjs'),
      "import { cosmiconfig } from 'cosmiconfig';\nimport { parse } from 'yaml';\nexport default { cosmiconfig, parse };\n",
    );
  };

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('resolves a nested dependency instead of calling a correct install broken', () => {
    const result = ThemeSsrDependencyCollector.collect(themeDir, packDir);

    expect(result.failed).toBe(false);
  });

  it('leaves the nested copy where npm put it, carried by its parent', () => {
    ThemeSsrDependencyCollector.collect(themeDir, packDir);

    const nested = path.join(packDir, 'node_modules', 'cosmiconfig', 'node_modules', 'yaml', 'package.json');
    expect(fs.existsSync(nested)).toBe(true);
    expect(JSON.parse(fs.readFileSync(nested, 'utf8')).version).toBe('1.10.2');
  });

  it('keeps both versions when both are needed, each where npm put it', () => {
    alsoNeedADifferentYamlInTheBundle();

    ThemeSsrDependencyCollector.collect(themeDir, packDir);

    // Both versions survive, each where npm put it. Flattening would leave one copy serving two
    // dependents that asked for different majors — wrong at runtime, and silent.
    const hoisted = path.join(packDir, 'node_modules', 'yaml', 'package.json');
    const nested = path.join(packDir, 'node_modules', 'cosmiconfig', 'node_modules', 'yaml', 'package.json');
    expect(JSON.parse(fs.readFileSync(hoisted, 'utf8')).version).toBe('2.4.0');
    expect(JSON.parse(fs.readFileSync(nested, 'utf8')).version).toBe('1.10.2');
  });

  it('still reports a dependency that genuinely is not installed', () => {
    fs.rmSync(path.join(themeDir, 'node_modules', 'cosmiconfig', 'node_modules', 'yaml'), { recursive: true });

    const result = ThemeSsrDependencyCollector.collect(themeDir, packDir);

    expect(result.failed).toBe(true);
    expect(String(result.message)).toContain('yaml');
  });
});
