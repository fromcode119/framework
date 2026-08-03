// RUNTIME entry — safe to bundle for the browser.
// The syntax/esbuild plugins are BUILD-TIME only (they read the filesystem), so they live behind
// `@fromcode119/typor/build`. Re-exporting them here would drag `node:fs` into every browser bundle
// that touches a class using `Typor.mixin` — which broke the admin service-worker build.
export { Typor } from './typor';
export type { IConstructor } from './interfaces/constructor.interface';

