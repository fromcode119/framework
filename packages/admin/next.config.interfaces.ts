/**
 * The `webpack` config hook's own parameter types, described from what `next.config.ts`'s callback
 * actually reads and writes — Next's own `NextJsWebpackConfig`/`WebpackConfigContext` types are not part
 * of its public `next` export surface (they type `config` as `any` internally), so an honest local shape
 * stands in for them.
 */
export interface AdminWebpackConfig {
  module: {
    rules: unknown[];
  };
  resolve: {
    alias: Record<string, string>;
    extensionAlias?: Record<string, string[]>;
    symlinks?: boolean;
    fallback?: Record<string, string | false>;
  };
  watchOptions?: {
    poll?: number;
    aggregateTimeout?: number;
  };
}

export interface AdminWebpackConfigContext {
  isServer: boolean;
  dev: boolean;
}
