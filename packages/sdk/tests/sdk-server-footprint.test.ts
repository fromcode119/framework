import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * What a plugin process loads when it imports `@fromcode119/sdk/server`.
 *
 * Every plugin runs in its own process and nearly all of them import this entry. It used to re-export
 * `APIServer`, and through it the whole api — graphql, drizzle, archiver, the MCP server — plus the core
 * index and the image library: about 2,200 modules and 70 MB in every plugin process, for plugins that
 * only wanted `BaseController`. Twenty-one plugins made the api container 2 GB.
 *
 * Loaded from the BUILT output in a fresh process, because that is what a plugin process runs and a
 * test runner's own module graph says nothing about it.
 */
describe('@fromcode119/sdk/server stays light', () => {
  const frameworkRoot = path.resolve(__dirname, '../../..');
  const entry = path.join(frameworkRoot, 'packages/sdk/dist/server.js');

  it('does not load the api, the core index or the image library', () => {
    expect(fs.existsSync(entry), `${entry} is missing — run the package build`).toBe(true);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-sdk-server-'));
    const probe = path.join(directory, 'probe.cjs');
    try {
      fs.writeFileSync(probe, [
        `require(${JSON.stringify(entry)});`,
        `const files = Object.keys(require.cache);`,
        `console.log(JSON.stringify({`,
        `  modules: files.length,`,
        `  api: files.filter((f) => f.includes('/packages/api/')).length,`,
        `  coreIndex: files.some((f) => f.endsWith('/packages/core/dist/index.js')),`,
        `  sharp: files.filter((f) => f.includes('/node_modules/sharp/')).length,`,
        `}));`,
      ].join('\n'));
      const loaded = JSON.parse(execFileSync(process.execPath, [probe], { encoding: 'utf8', cwd: frameworkRoot }).trim());
      expect(loaded.api).toBe(0);
      expect(loaded.coreIndex).toBe(false);
      expect(loaded.sharp).toBe(0);
      // Measured at 267 after the fix, 2,190 before it: room to grow, never back to the old graph.
      expect(loaded.modules).toBeLessThan(600);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
