// RELATIVE imports, on purpose, throughout `packages/sdk/src/vite/`: these modules are loaded by
// vite's own config loader (nextor generates `*.config.ts` glue beside them at pack time), which
// bundles the config with esbuild and knows nothing of tsconfig `paths`. An `@sdk/...` specifier
// here fails every plugin and theme UI build with "Cannot find module". Everything else in the SDK
// uses the alias.
export { FromcodeThemeOverridesPlugin } from './fromcode-theme-overrides-plugin';
export type { IFromcodeThemeOverridesOptions } from './interfaces/fromcode-theme-overrides-options.interface';
