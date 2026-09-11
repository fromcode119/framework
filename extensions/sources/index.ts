import { SourcesLifecycle } from '@plugin/src/on-init';

/**
 * The manifest lives in `manifest.json` like every other plugin's.
 *
 * It used to be declared INLINE here, and an inline manifest REPLACES the one on disk
 * (PluginDirectoryScannerService) — so the admin block in manifest.json was dead weight, and a change
 * made there (moving this out of Platform and renaming "Builds" to "Sources") silently did nothing.
 * `sandbox: false` is declared in the file now, and it is load-bearing: an absent value means
 * SANDBOXED, and this plugin clones repositories and writes build output on the host.
 */
export class SourcesExtension {
  static readonly onInit = SourcesLifecycle.onInit;
}
