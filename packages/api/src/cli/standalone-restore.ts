#!/usr/bin/env node
import { ProcessEntry } from '@fromcode119/core/process';
import { StandaloneRestoreCli } from '@api/cli/standalone-restore-cli';

/** `node dist/cli/standalone-restore.js …` — the CLI's exit code is `main`'s number. */
@ProcessEntry.start('standalone-restore')
export class StandaloneRestoreBin {
  static main(argv: string[]): Promise<number> {
    return StandaloneRestoreCli.main(argv);
  }
}
