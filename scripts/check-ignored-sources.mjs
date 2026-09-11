#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Refuses to build when a SOURCE file under `packages/` is gitignored.
 *
 * Twice in one day an ignore rule quietly ate real code. `bundled-plugins/` shipped an extension with
 * no `index.js` because the plugin's own ignore file travelled with it. Then a package folder named
 * `build/` matched the universal `build/` rule, so nine TypeScript files were never committed — every
 * local build passed (the files are on disk) and the IMAGE build failed, because it clones from git.
 *
 * That failure mode is the reason this exists: an ignored source file is invisible to every check
 * that reads the working tree, and only shows up where it costs the most.
 */
class IgnoredSources {
  /** Hand-written source. `.d.ts` is EMITTED beside source in some packages and is correctly ignored. */
  static SOURCE = /\.(ts|tsx)$/;
  static DECLARATION = /\.d\.ts$/;
  /** Output, not source: these are ignored on purpose and are not committed. */
  static OUTPUT = /(^|\/)(dist|node_modules|\.next|coverage)\//;

  static run() {
    const files = execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', 'packages/'], {
      // fileURLToPath, not `url.pathname`: this checkout's path contains a space, and the raw
      // pathname keeps it percent-encoded — git then spawns against a directory that does not exist.
      encoding: 'utf8', cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    }).split('\n').filter(Boolean);

    const offenders = files.filter((f) => IgnoredSources.SOURCE.test(f)
      && !IgnoredSources.DECLARATION.test(f)
      && !IgnoredSources.OUTPUT.test(f));
    if (offenders.length === 0) {
      console.log(`[check-ignored-sources] OK (${files.length} ignored files under packages/, none of them source)`);
      return;
    }

    console.error('[check-ignored-sources] These source files are IGNORED and will not reach a clone:\n');
    for (const file of offenders) console.error(`  ${file}`);
    console.error('\nA local build passes because the files are on disk; the image build clones from git');
    console.error('and fails. Rename the directory rather than adding an ignore exception — a folder that');
    console.error('collides with a universal rule like `build/` will collide again.');
    process.exitCode = 1;
  }
}

IgnoredSources.run();
