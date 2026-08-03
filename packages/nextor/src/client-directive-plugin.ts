import { UseClientPlugin } from './use-client-plugin';

/**
 * Decides — and injects — the `'use client'` directive at BUILD time, so the literal never appears in
 * source. Next scans for the string, so it cannot be an import, class, or decorator; a build step is the
 * only clean way, and that step belongs in nextor.
 *
 * A module is a client module when EITHER:
 *   • its filename says so (`foo.client.tsx`) — the established convention, or
 *   • it is a Next route/page file whose exported class extends a reactor base
 *     (`Reactor` / `PureReactor` / `Provider` / `Bridge`), which can only run on the client.
 *
 * Server components are async functions returning JSX and never extend those bases, so they are left alone.
 */
export class ClientDirectivePlugin {
  /** reactor base classes that imply a client component. */
  static readonly CLIENT_BASES = ['Reactor', 'PureReactor', 'Provider', 'Bridge'];

  static extendsReactorBase(source: string): boolean {
    return new RegExp(`^export\\s+(?:default\\s+)?class\\s+[\\w$]+\\s+extends\\s+(?:${ClientDirectivePlugin.CLIENT_BASES.join('|')})\\b`, 'm')
      .test(source);
  }

  static isClientModule(source: string, path: string): boolean {
    if (UseClientPlugin.filenamePattern.test(path)) return true;
    return ClientDirectivePlugin.extendsReactorBase(source);
  }

  /** Idempotent — safe under watch mode and repeated loader passes. */
  static injectInto(source: string, path: string): string {
    if (!ClientDirectivePlugin.isClientModule(source, path)) return source;
    return UseClientPlugin.injectInto(source);
  }
}
