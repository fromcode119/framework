#!/usr/bin/env node
import { ProcessEntry } from '@fromcode119/core/process';
import { TenantExportCli } from '@api/cli/tenant-export-cli';

/** `node dist/cli/tenant-export.js …` — the CLI's exit code is `main`'s number. */
@ProcessEntry.start('tenant-export')
export class TenantExportBin {
  static main(argv: string[]): Promise<number> {
    return TenantExportCli.main(argv);
  }
}
