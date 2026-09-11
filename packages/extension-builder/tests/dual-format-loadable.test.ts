import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The CommonJS artifact must actually load.
 *
 * This package ships two builds of the same code. `dist/index.cjs` is the esbuild bundle the api
 * REQUIRES at runtime, and it is the one that took staging down: `createRequire(import.meta.url)` is
 * `undefined` inside a CJS bundle, so the api crash-looped while the CLI — which also requires the
 * same file — had been verified and looked fine. Loading it in a fresh process is the check that was
 * missing.
 *
 * `dist/index.js` is deliberately NOT loaded here. It is `tsc` output with extensionless relative
 * imports, which a BUNDLER resolves and Node's strict ESM loader does not — and nothing we ship
 * takes that condition: the CLI compiles to CommonJS and requires the bundle. Bundling it to satisfy
 * a loader with no consumer is not free either: doing exactly that to its sibling
 * react-class-components collapsed every module into one, so importing anything from it dragged
 * `react-dom/client` into a Server Component and broke the frontend build outright.
 */
describe('extension-builder ships a loadable CommonJS bundle', () => {
  const packageRoot = path.resolve(__dirname, '..');
  const esm = path.join(packageRoot, 'dist/index.js');
  const cjs = path.join(packageRoot, 'dist/index.cjs');

  it('has both artifacts built', () => {
    expect(fs.existsSync(esm), `${esm} is missing — run the package build`).toBe(true);
    expect(fs.existsSync(cjs), `${cjs} is missing — run the package build`).toBe(true);
  });

  /** From a real FILE: code run with `node -e` evaluates as `[eval]`, where `createRequire` throws. */
  it('can be require()d, the way the api and the CLI load it', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-loadable-'));
    const probe = path.join(directory, 'probe.cjs');
    try {
      fs.writeFileSync(probe, `const m = require(${JSON.stringify(cjs)});\nconsole.log(Object.keys(m).length > 0 ? 'ok' : 'empty');\n`);
      const output = execFileSync(process.execPath, [probe], { encoding: 'utf8', cwd: packageRoot }).trim();
      expect(output).toBe('ok');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
