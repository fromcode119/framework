import path from 'node:path';
import { MiddlewareGlueGenerator } from '../middleware-glue-generator';
import { NextorCommand } from './next-build-codegen-command';

/**
 * `next-build-codegen generate-middleware [pkgDir]` — generate Next's middleware module from the authored class,
 * before `next build` runs. Defaults to the cwd.
 */
export class GenerateMiddlewareCommand extends NextorCommand {
  readonly summary = 'Generate Next middleware glue from the authored class [pkgDir].';

  run(argv: string[]): number {
    const packageDir = path.resolve(argv[0] ?? process.cwd());
    const written = MiddlewareGlueGenerator.generate(packageDir);
    console.log(written
      ? `[next-build-codegen] generated ${path.relative(packageDir, written)} from proxy-route.ts`
      : '[next-build-codegen] no proxy-route.ts — nothing to generate');
    return 0;
  }
}
