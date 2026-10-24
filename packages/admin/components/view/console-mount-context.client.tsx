import { Context } from '@fromcode119/react-class-components';

/**
 * The console path this document is mounted at (`/backend`), or `''` when the console is not mounted
 * on a site's own host. Filled by `ConsoleMountProvider` from the request, so a value read here is the
 * same on the server render and in the browser — an address built from `document` alone would differ
 * between the two, and React does not repair a mismatched attribute on hydration.
 */
export class ConsoleMountContext {
  static readonly context = new Context<string>('').raw;
}
