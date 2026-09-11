import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

/**
 * Where this package's code lives — in a form that works in BOTH outputs it ships.
 *
 * The build emits an ES module (`dist/index.js`, for the CLI) AND an esbuild CommonJS bundle
 * (`dist/index.cjs`, which the api loads in-process). `import.meta.url` is undefined in the CJS
 * bundle and `__filename` does not exist in the ES module, so either one alone breaks the other
 * half: hardcoding `import.meta.url` crashed the api at load with "The argument 'filename' must be
 * a file URL object… Received undefined", and took the whole deployment down with it.
 *
 * `typeof` rather than a bare reference: an undeclared identifier throws, `typeof` on one does not.
 */
export class ModuleLocation {
  /** A path or file URL — whichever this format provides. Only ever handed to Node's own helpers. */
  static get href(): string {
    return typeof __filename === 'string' ? __filename : import.meta.url;
  }

  static get directory(): string {
    const href = ModuleLocation.href;
    return path.dirname(href.startsWith('file:') ? fileURLToPath(href) : href);
  }

  /** A `require` bound to this package, for CommonJS dependencies an ES module cannot name-import. */
  static require(specifier: string): any {
    return ModuleLocation.requireFrom()(specifier);
  }

  /** The bound `require` itself, for callers that resolve as well as load. */
  static requireFrom(): NodeJS.Require {
    return createRequire(ModuleLocation.href);
  }

  static resolve(specifier: string): string {
    return ModuleLocation.requireFrom().resolve(specifier);
  }
}
