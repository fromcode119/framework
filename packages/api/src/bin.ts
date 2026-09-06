#!/usr/bin/env node
import { ProcessEntry } from '@fromcode119/core/process';
import { ApiEntry } from '@api/api-entry';

/** The `fromcode-api` binary and what the container runs as `node dist/bin.js`. */
@ProcessEntry.start('api')
export class ApiBin {
  static main(): void {
    ApiEntry.main();
  }
}
