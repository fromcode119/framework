import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * `fromcode pack` must actually run.
 *
 * It broke completely once and nothing caught it: four separate ESM faults — a barrel the CJS lexer
 * silently truncated, a default import of a CJS module, `__filename` in five files, a bare
 * `require('tar')` — each invisible to typechecks and to every existing suite, because no test had
 * ever executed the command end to end. The CLI even printed `✗ archive-writer` with no message.
 *
 * This runs the real binary against the real bundled extension and asserts an archive appears. It
 * is slower than a unit test and that is the point: the failure it guards against is "the program
 * does not start".
 */
describe('fromcode pack produces an archive', () => {
  const frameworkRoot = path.resolve(__dirname, '../../..');
  const monorepoRoot = path.resolve(frameworkRoot, '../..');
  const bin = path.join(frameworkRoot, 'packages/cli/dist/bin.js');
  const slug = 'build-server';

  it('packs a plugin and writes a tarball', () => {
    if (!fs.existsSync(bin)) {
      throw new Error(`${bin} is missing — build the CLI before running this suite`);
    }

    const output = execFileSync(process.execPath, [bin, 'pack', 'plugin', slug], {
      cwd: monorepoRoot,
      encoding: 'utf8',
      timeout: 300_000,
    });

    // The CLI reports each step; a step that fails prints `✗` and the message it was given.
    expect(output).not.toContain('✗');

    const archiveLine = output.split('\n').find((line) => line.includes('.tar.gz'));
    expect(archiveLine, 'pack printed no archive path').toBeTruthy();

    const archive = archiveLine!.slice(archiveLine!.indexOf('/')).trim();
    expect(fs.existsSync(archive), `${archive} was reported but does not exist`).toBe(true);
    expect(fs.statSync(archive).size).toBeGreaterThan(1024);
  }, 300_000);
});
