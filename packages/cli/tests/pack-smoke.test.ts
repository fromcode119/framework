import { afterAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * `atlantis pack` must actually run.
 *
 * It is also the only end-to-end exercise of the PACK half of the pipeline — `PackCleaner`, the
 * theme SSR dependency collector and the stamp over the cleaned directory. The server build path
 * stages that same directory and installs from it, so a break here breaks installing too.
 *
 * It broke completely once and nothing caught it: four separate ESM faults — a barrel the CJS lexer
 * silently truncated, a default import of a CJS module, `__filename` in five files, a bare
 * `require('tar')` — each invisible to typechecks and to every existing suite, because no test had
 * ever executed the command end to end. The CLI even printed `✗ archive-writer` with no message.
 *
 * It runs the real binary and asserts an archive appears. It is slower than a unit test and that is
 * the point: the failure it guards against is "the program does not start".
 *
 * THE SUBJECT IS A FIXTURE THIS TEST WRITES, not a plugin that happens to be checked out beside the
 * framework. It used to pack `build-server`, which was deleted when Sources became part of the
 * framework, and this suite — whose whole job is to prove the command runs — spent weeks failing on
 * a missing directory. It was then pointed at a plugin, which is a different repository: the day the
 * suite first ran in CI, against a framework-only checkout, it failed the same way for the same
 * reason. A fixture cannot be deleted by someone else and needs nothing else on disk.
 */
describe('atlantis pack produces an archive', () => {
  const frameworkRoot = path.resolve(__dirname, '../../..');
  const bin = path.join(frameworkRoot, 'packages/cli/dist/bin.js');
  const slug = 'packsmoke';
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-smoke-'));

  afterAll(() => fs.rmSync(projectRoot, { recursive: true, force: true }));

  /** The smallest thing the pipeline recognises as a plugin: a manifest and a backend entry. */
  const writeFixture = (): void => {
    const dir = path.join(projectRoot, 'plugins', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify({
      name: 'Pack Smoke',
      slug,
      version: '0.0.1',
      description: 'Fixture plugin. Exists only so the pack pipeline has something to pack.',
      author: 'Fromcode',
      main: 'index.js',
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(dir, 'index.ts'),
      'export class PackSmokePlugin {\n  static readonly slug = \'packsmoke\';\n}\n\nexport default PackSmokePlugin;\n',
      'utf8');
  };

  it('packs a plugin and writes a tarball', () => {
    if (!fs.existsSync(bin)) {
      throw new Error(`${bin} is missing — build the CLI before running this suite`);
    }
    writeFixture();

    // `ATLANTIS_PROJECT_ROOT` is what decides where `plugins/` is read from and where `dist/` is
    // written, so the whole run happens inside the temp directory and touches no checkout.
    const output = execFileSync(process.execPath, [bin, 'pack', 'plugin', slug], {
      cwd: frameworkRoot,
      env: { ...process.env, ATLANTIS_PROJECT_ROOT: projectRoot },
      encoding: 'utf8',
      timeout: 300_000,
    });

    // The CLI reports each step; a step that fails prints `✗` and the message it was given.
    expect(output).not.toContain('✗');

    const archiveLine = output.split('\n').find((line) => line.includes('.tar.gz'));
    expect(archiveLine, 'pack printed no archive path').toBeTruthy();

    const archive = archiveLine!.slice(archiveLine!.indexOf('/')).trim();
    expect(fs.existsSync(archive), `${archive} was reported but does not exist`).toBe(true);

    // What the archive CONTAINS, rather than how big it is. The old assertion was a 1 KB floor
    // calibrated against whichever real plugin the test happened to name, which says nothing about
    // whether the pipeline produced anything useful — and a fixture legitimately compresses below it.
    // These two entries are the pack's actual output: the manifest it stamps and the COMPILED entry,
    // whose presence is the proof that the backend compiler ran rather than being skipped.
    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
      .split('\n').map((entry) => entry.trim()).filter(Boolean);
    expect(entries).toContain('manifest.json');
    expect(entries).toContain('index.js');
    expect(entries).not.toContain('index.ts');
  }, 300_000);
});
