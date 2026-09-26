/**
 * The public URL segments of the framework's own runtime assets — the storefront runtime bundle
 * (`/fc-runtime/runtime-<hash>.js`) and the per-icon Lucide data modules
 * (`/fc-runtime/icons/<lucide version>/<name>.js`) — served from each Next app's `public/` directory.
 *
 * The ONE place these names live: the frontend build config (output dir), the admin/frontend
 * `headers()` rules (immutable cache), `RouteSegmentUtils` (reserved root segment, so a content page can
 * never shadow them) and the browser-side icon loader (URL) all read this class. Deliberately free
 * of imports so a build-time config loaded by Vite's own config bundler can import it relatively.
 */
export class RuntimeAssetConstants {
  /** Root URL segment, reserved on both apps. */
  static readonly SEGMENT = 'fc-runtime';

  /** Sub-segment under {@link SEGMENT} holding the per-icon data modules, one directory per version. */
  static readonly ICONS_SEGMENT = 'icons';

  /**
   * File name, beside the icon modules, of the static `lucide-react` namespace module: one named export
   * per icon, each read from the runtime registry. The import map points `lucide-react` at it.
   */
  static readonly LUCIDE_NAMESPACE_FILE = 'lucide-react.js';

  /**
   * The window global holding the host→bundle runtime registry (`RuntimeConstants.GLOBALS.MODULES`
   * reads it from here). Declared in this import-free file so the build-time icon emitter can bake it
   * into the namespace module without importing the rest of the constants graph.
   */
  static readonly REGISTRY_GLOBAL = '__fromcodeRuntimeModules';
}
