import { APIServer } from '@api/index';

/**
 * Boots the API server, turning an unhandled bootstrap failure into a non-zero exit.
 *
 * Both process entries delegate here — `bin.ts` (the `fromcode-api` binary, and what the container runs
 * as `node dist/bin.js`) and `server.ts` (the `tsx watch` dev entry). They used to carry a byte-identical
 * copy of the bootstrap call and its error handler; the behaviour lives in one class so a change to it
 * cannot apply to only one of the two.
 */
export class ApiEntry {
  static main(): void {
    APIServer.bootstrap().catch(ApiEntry.fail);
  }

  private static fail(error: unknown): void {
    console.error('Unhandled exception during bootstrap execution:', error);
    process.exit(1);
  }
}
