import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Both published artifacts must actually LOAD.
 *
 * This package ships two builds of the same code: `dist/index.js` for ESM and `dist/index.cjs` for
 * the CommonJS bundle the api requires at runtime. Twice now the ESM half was verified and shipped
 * while the CJS half threw on import — `createRequire(import.meta.url)` is `undefined` inside the
 * esbuild CJS bundle, and `__filename` does not exist in the ESM one. Both took staging down, and
 * both were invisible to every check we had: the CLI exercises one half, the api the other.
 *
 * A fresh process per format, because importing a module twice in one process proves nothing about
 * the second loader — and from a real FILE rather than `node -e`, because code evaluated with `-e`
 * runs as `[eval]`, where `createRequire` throws for reasons that have nothing to do with the
 * artifact. A test that fails for the wrong reason is worse than no test.
 */
describe('extension-builder ships two loadable formats', () => {
  const packageRoot = path.resolve(__dirname, '..');
  const esm = path.join(packageRoot, 'dist/index.js');
  const cjs = path.join(packageRoot, 'dist/index.cjs');

  const loads = (code: string, extension: 'mjs' | 'cjs'): string => {
    const probe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-loadable-')), `probe.${extension}`);
    try {
      fs.writeFileSync(probe, code);
      return execFileSync(process.execPath, [probe], { encoding: 'utf8', cwd: packageRoot }).trim();
    } finally {
      fs.rmSync(path.dirname(probe), { recursive: true, force: true });
    }
  };

  it('has both artifacts built', () => {
    expect(fs.existsSync(esm), `${esm} is missing — run the package build`).toBe(true);
    expect(fs.existsSync(cjs), `${cjs} is missing — run the package build`).toBe(true);
  });

  it('can be require()d as CommonJS, the way the api loads it', () => {
    const output = loads(`const m = require(${JSON.stringify(cjs)}); console.log(Object.keys(m).length > 0 ? 'ok' : 'empty');`, 'cjs');
    expect(output).toBe('ok');
  });

  it('can be imported as ESM, the way the CLI loads it', () => {
    const output = loads(`import * as m from ${JSON.stringify(esm)};\nconsole.log(Object.keys(m).length > 0 ? 'ok' : 'empty');`, 'mjs');
    expect(output).toBe('ok');
  });
});
