import path from 'node:path';
import { MiddlewareGlueGenerator } from '../middleware-glue-generator';
import { NextorCommand } from './nextor-command';

/**
 * `nextor generate-middleware [pkgDir]` — generate Next's middleware module from the authored class,
 * before `next build` runs. Defaults to the cwd.
 */
export class GenerateMiddlewareCommand extends NextorCommand {
  readonly summary = 'Generate Next middleware glue from the authored class [pkgDir].';

  run(argv: string[]): number {
    const packageDir = path.resolve(argv[0] ?? process.cwd());
    const written = MiddlewareGlueGenerator.generate(packageDir);
    console.log(written
      ? `[nextor] generated ${path.relative(packageDir, written)} from proxy-route.ts`
      : '[nextor] no proxy-route.ts — nothing to generate');
    return 0;
  }
}
