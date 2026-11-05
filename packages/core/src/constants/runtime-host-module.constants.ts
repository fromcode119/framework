/**
 * The host → plugin/theme runtime handoff, as an ES MODULE instead of a window global.
 *
 * A browser evaluates each module URL once per document, so every importer of the SAME url shares one
 * instance. The host is therefore a `data:` url built from a constant: the framework bundle (admin or
 * storefront runtime) and every generated import-map module import exactly this string, and all of them
 * see the one store inside it. Nothing is served, nothing is written to a file, and nothing lives on
 * `window`.
 *
 * Writing is a capability, not a property: `claim()` hands out the writer. The framework claims it while it
 * boots, before any extension bundle is loaded. While the document is still loading, a second framework
 * bundle on the page (each carries its own copy of core) gets the same writer, so both share one store;
 * once the document has loaded, every later claim gets `null`. Reading (`get`) is
 * open, exactly as reading `import 'react'` is open to any module on the page.
 */
export class RuntimeHostModule {
  /** The module body. Plain ES, no imports, no globals. */
  private static readonly SOURCE = [
    'const store = new Map();',
    'let claimed = false;',
    'const write = (key, value) => { store.set(key, value); };',
    'export function claim() {',
    '  if (claimed && document.readyState === "complete") return null;',
    '  claimed = true;',
    '  return write;',
    '}',
    'export function get(key) { return store.get(key); }',
  ].join('\n');

  /** The one url every importer uses. Identical string → identical module instance. */
  static readonly URL = `data:text/javascript,${encodeURIComponent(RuntimeHostModule.SOURCE)}`;

  /**
   * A short, stable fingerprint of the host source (FNV-1a, base 36). A static file that imports the host
   * is cached as immutable, and a browser holding the copy that imports an OLDER host url reads a
   * different, empty host. Such a file is therefore named by this tag, so a host change is a new url.
   */
  static readonly TAG = RuntimeHostModule.fingerprint(RuntimeHostModule.SOURCE);

  /** `<base>.<TAG>.js` — the name of a static file that imports the host. */
  static taggedFile(base: string): string {
    return `${base}.${RuntimeHostModule.TAG}.js`;
  }

  private static fingerprint(text: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  /** Local name generated modules read the host through. */
  static readonly GETTER = '__fcHostGet';

  /** First line of every generated module: binds `GETTER` to the host's `get`. */
  static readonly IMPORT = `import { get as ${RuntimeHostModule.GETTER} } from ${JSON.stringify(RuntimeHostModule.URL)};`;

  /** Expression reading one runtime module through the host, for generated module sources. */
  static expr(key: string): string {
    return `${RuntimeHostModule.GETTER}(${JSON.stringify(key)})`;
  }

  /** A generated module's source with the host import in front of it. */
  static withImport(body: string): string {
    return `${RuntimeHostModule.IMPORT}\n${body}`;
  }
}
