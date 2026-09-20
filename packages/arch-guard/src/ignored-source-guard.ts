/* eslint-disable */
import { execFileSync } from 'node:child_process';
import { FrameworkRoot } from './cli/framework-root';

/**
 * A SOURCE file under `packages/` that git is ignoring, and therefore will never reach a clone.
 *
 * Twice in one day an ignore rule quietly ate real code. A bundled extension shipped with no entry
 * point because the extension's own ignore file travelled with it. Then a package folder named
 * `build/` matched the universal `build/` rule, so nine TypeScript files were never committed — every
 * local build passed, because the files are on disk, and the IMAGE build failed, because it clones
 * from git.
 *
 * That asymmetry is the whole reason this exists: an ignored source file is invisible to every check
 * that reads the working tree, and surfaces only where it costs the most.
 */
export class IgnoredSourceGuard {
  /** Hand-written source. `.d.ts` is EMITTED beside source in some packages and is correctly ignored. */
  private static readonly SOURCE = /\.(ts|tsx)$/;
  private static readonly DECLARATION = /\.d\.ts$/;

  /** Output, not source: ignored on purpose and never committed. */
  private static readonly OUTPUT = /(^|\/)(dist|node_modules|\.next|coverage)\//;

  static run(): number {
    let listed = '';
    try {
      listed = execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', 'packages/'], {
        encoding: 'utf8',
        cwd: FrameworkRoot.find(),
        // `.next` and `node_modules` alone put ~76,000 paths and 4.6 MB through this pipe, and the
        // default maxBuffer is 1 MB — so this did not report a violation, it THREW ENOBUFS, which
        // reads as a broken build step rather than an unchecked one. A gate that fails to RUN is
        // worse than one that fails, and this is wired into `npm run build`.
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      console.error(`[ignored-sources] could not ask git what it ignores: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }

    const files = listed.split('\n').filter(Boolean);
    const offenders = files.filter((file) => IgnoredSourceGuard.SOURCE.test(file)
      && !IgnoredSourceGuard.DECLARATION.test(file)
      && !IgnoredSourceGuard.OUTPUT.test(file));

    if (!offenders.length) {
      console.log(`Ignored files under packages/: ${files.length}; none of them source.`);
      return 0;
    }

    console.error(`${offenders.length} source file(s) are IGNORED and will not reach a clone:\n`);
    for (const file of offenders) console.error(`  ${file}`);
    console.error('\nA local build passes because the files are on disk; the image build clones from git and');
    console.error('fails. Rename the directory rather than adding an ignore exception — a folder that collides');
    console.error('with a universal rule like `build/` will collide again.');
    return 1;
  }
}
