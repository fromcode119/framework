import path from 'node:path';
import { LucideIconNodeEmitter } from './lucide-icon-node-emitter';

/**
 * `tsx lucide-icon-node-emitter-cli.ts <namesFile> <publicDir…>` — the `build:frontend-icons` script.
 *
 * Argv parsing and the exit code only; `LucideIconNodeEmitter` owns the work (the next-build-codegen / arch-guard CLI
 * shape). The names file and the target `public/` directories are ARGUMENTS so this file names no app:
 * the root package.json decides which apps serve the icon set.
 */
export class LucideIconNodeEmitterCli {
  static async main(argv: string[]): Promise<number> {
    const [namesFile, ...publicDirs] = argv;
    if (!namesFile || publicDirs.length === 0) {
      console.error('usage: lucide-icon-node-emitter-cli <namesFile> <publicDir…>');
      return 2;
    }
    const result = await LucideIconNodeEmitter.emit(path.resolve(namesFile), publicDirs.map((dir) => path.resolve(dir)));
    console.log(`[frontend-icons] lucide-react ${result.version}: ${result.count} icon modules -> ${result.dirs.map((dir) => path.relative(process.cwd(), dir)).join(', ')}; names -> ${path.relative(process.cwd(), path.resolve(namesFile))}`);
    return 0;
  }
}

LucideIconNodeEmitterCli.main(process.argv.slice(2)).then((code) => process.exit(code));
