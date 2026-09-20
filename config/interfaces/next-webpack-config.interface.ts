/**
 * The `webpack` hook's own parameter types, shared by both Next apps.
 *
 * Next does not export these: internally it types that argument `any`, so there is nothing to import
 * and each config would otherwise describe the same shape for itself. They live beside the config
 * both apps already read, so the two cannot drift.
 *
 * The shape is what these callbacks actually touch, not all of webpack. `resolve.modules` is
 * REQUIRED even though only the frontend reads it: webpack always supplies it, and typing it
 * optional only moved the lie to the call site, which then had to guard against an absence that
 * cannot happen.
 */
export interface INextWebpackConfig {
  module: {
    rules: unknown[];
  };
  resolve: {
    alias: Record<string, string>;
    extensionAlias?: Record<string, string[]>;
    symlinks?: boolean;
    modules: string[];
    fallback?: Record<string, string | false>;
  };
  watchOptions?: {
    poll?: number;
    aggregateTimeout?: number;
  };
}
