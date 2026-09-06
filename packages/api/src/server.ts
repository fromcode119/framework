import { ProcessEntry } from '@fromcode119/core/process';
import { ApiEntry } from '@api/api-entry';

/** The `tsx watch` development entry; same boot as `bin.ts`. */
@ProcessEntry.start('api')
export class ApiDevServer {
  static main(): void {
    ApiEntry.main();
  }
}
