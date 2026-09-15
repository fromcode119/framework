#!/usr/bin/env node
import { ProcessEntry } from '@fromcode119/core/process';
import { TenantImportCli } from '@api/cli/tenant-import-cli';

/** `node dist/cli/tenant-import.js …` — the CLI's exit code is `main`'s number. */
@ProcessEntry.start('tenant-import')
export class TenantImportBin {
  static main(argv: string[]): Promise<number> {
    return TenantImportCli.main(argv);
  }
}
