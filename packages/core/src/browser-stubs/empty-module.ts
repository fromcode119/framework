/**
 * Browser-safe EMPTY module: what a Node built-in (`fs`, `crypto`, `stream`, …) resolves to in a browser
 * build. webpack expresses this as `resolve.fallback: { fs: false }`; a bundler with no `fallback` option
 * (the Vite runtime build) aliases the same list — config/next-config-env.js `getNodeBuiltinFallbacks` —
 * to this file. None of these modules are ever CALLED in the browser; the imports only exist because
 * core/src server-only files sit in the same source tree. The class is never referenced.
 */
export class EmptyModule {}
