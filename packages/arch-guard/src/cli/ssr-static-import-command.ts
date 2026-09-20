import { SsrStaticImportGuard } from '../ssr-static-import-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard ssr-static-imports` — a server bundle that statically imports the admin barrel never loads. */
export class SsrStaticImportCommand extends ArchorCommand {
  readonly summary = 'Server bundles must not statically import the SDK admin barrel.';

  run(_argv: string[]): number {
    return SsrStaticImportGuard.run();
  }
}
