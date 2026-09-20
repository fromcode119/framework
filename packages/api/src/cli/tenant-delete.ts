#!/usr/bin/env node
import { ProcessEntry } from '@fromcode119/core/process';
import { TenantDeleteCli } from '@api/cli/tenant-delete-cli';

/** `node dist/cli/tenant-delete.js …` — the CLI's exit code is `main`'s number. */
@ProcessEntry.start('tenant-delete')
export class TenantDeleteBin {
  static main(argv: string[]): Promise<number> {
    return TenantDeleteCli.main(argv);
  }
}
