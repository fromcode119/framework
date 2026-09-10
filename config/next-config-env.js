const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

class NextConfigEnv {
  static initializeEnvironment() {
    if (NextConfigEnv.environmentInitialized) {
      return;
    }

    const rootDir = path.resolve(__dirname, '..');
    const envFiles = [
      path.join(rootDir, '.env.local'),
      path.join(rootDir, '.env'),
    ];

    let loadedAnyFile = false;
    for (const envFile of envFiles) {
      if (!fs.existsSync(envFile)) {
        continue;
      }

      dotenv.config({ path: envFile, override: false });
      loadedAnyFile = true;
    }

    if (!loadedAnyFile) {
      const exampleEnvFile = path.join(rootDir, '.env.example');
      if (fs.existsSync(exampleEnvFile)) {
        dotenv.config({ path: exampleEnvFile, override: false });
      }
    }

    NextConfigEnv.environmentInitialized = true;
  }

  /**
   * The hosts the DEV server will serve `/_next/*` to. Next blocks every other Host outright, and the
   * failure is silent from the browser's side: the document still streams, so the page paints its
   * server-rendered shell and then never hydrates — no console error, no failed request, just a screen
   * that never becomes interactive. On the admin that shell is an empty full-height div, i.e. a white
   * page, which is exactly what a workspace domain (`app.<site>`) showed.
   *
   * Under multi-tenancy the three app URLs below cannot be the whole list: every SITE gets its own host
   * and they are created in the admin, long after this file is read. So the deployment's SITE DOMAIN is
   * a source too — `COOKIE_DOMAIN` is where the platform already declares it, being the domain whose
   * subdomains share one admin session. Everything under it is by definition one of ours, and it
   * expands to a wildcard so a site added at 3pm works without editing a config.
   *
   * `ALLOWED_DEV_ORIGINS` remains the explicit override for anything neither rule covers.
   */
  static getAllowedDevOrigins() {
    NextConfigEnv.initializeEnvironment();

    const explicitOrigins = NextConfigEnv.parseCommaSeparatedValues(process.env.ALLOWED_DEV_ORIGINS);
    const inferredOrigins = [
      process.env.ADMIN_URL,
      process.env.FRONTEND_URL,
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.PUBLIC_APP_URL,
      process.env.APP_URL,
    ];

    return NextConfigEnv.unique([
      ...explicitOrigins.flatMap((value) => NextConfigEnv.expandOriginCandidates(value)),
      ...inferredOrigins.flatMap((value) => NextConfigEnv.expandOriginCandidates(value)),
      ...NextConfigEnv.expandSiteDomainCandidates(process.env.COOKIE_DOMAIN),
    ]);
  }

  /**
   * `.framework.local` -> `['framework.local', '**.framework.local']`. The double star is deliberate:
   * Next's matcher gives `*` exactly ONE label, so `*.framework.local` would allow
   * `tagiqx.framework.local` and still block the workspace host `app.tagiqx.framework.local`. `**` is
   * the recursive form (it is what Next's own built-in `**.localhost` entry uses), and the apex is
   * listed separately because a wildcard there is rejected by design.
   *
   * A single-host deployment sets no cookie domain, or sets one that is a bare hostname rather than a
   * suffix; then there are no extra sites to allow and this contributes nothing.
   */
  static expandSiteDomainCandidates(value) {
    const domain = String(value || '').trim().replace(/^\.+/, '').replace(/\.+$/, '').toLowerCase();
    if (!domain || !domain.includes('.')) return [];
    return [domain, `**.${domain}`];
  }

  static getRemoteImagePatterns() {
    NextConfigEnv.initializeEnvironment();

    const candidates = [
      process.env.STORAGE_PUBLIC_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.API_URL,
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
    ];

    return NextConfigEnv.uniqueByKey(
      candidates
        .map((value) => NextConfigEnv.toRemotePattern(value))
        .filter(Boolean),
      (pattern) => `${pattern.protocol}//${pattern.hostname}`,
    );
  }

  static getAdminBasePath() {
    NextConfigEnv.initializeEnvironment();

    const fromAdminUrl = NextConfigEnv.deriveBasePathFromUrl(process.env.ADMIN_URL || '', '');
    if (fromAdminUrl) {
      return fromAdminUrl;
    }

    return NextConfigEnv.normalizePathPrefix(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
  }

  // ---------------------------------------------------------------------------------------------
  // The ONE alias / stub / builtin map for every bundler that compiles the storefront client graph.
  //
  // Next (turbopack + webpack, `packages/frontend/next.config.js`) and the standalone runtime bundle
  // (`packages/frontend/build/frontend-runtime-vite-config.ts`) both read THESE lists and adapt them
  // to their own option shape. A second, hand-copied list is what killed the previous islands attempt
  // (STOREFRONT-PERF-BASELINE.md, "islands step 2 — backed out"): the day the copies drift, the
  // storefront ships server code or fails to build. Add an entry here, never in a bundler config.
  // ---------------------------------------------------------------------------------------------

  /**
   * Package -> SOURCE tree aliases, so every bundler compiles `@fromcode119/*` from `packages/<pkg>/src`
   * (never a stale `dist`) and understands the typescript-multiple-inheritance package-private prefixes (`@core/x`) and the
   * frontend's own `@/`.
   *
   * Shape: `{ specifier, dir, entry }` maps the bare specifier to `dir/entry` and `specifier/<sub>` to
   * `dir/<sub>`; `{ specifier, file }` is an exact single-file mapping; `subpathsOnly: true` marks a
   * prefix that only ever appears with a subpath (`@core/…`, `@/…`).
   */
  static getSourceAliases(frontendDir) {
    const src = (pkg) => path.resolve(frontendDir, '..', pkg, 'src');
    const alias = NextConfigEnv.sourceAlias;
    const publicPackages = [
      alias({ specifier: '@fromcode119/react', dir: src('react'), entry: 'index.ts' }),
      alias({ specifier: '@fromcode119/core', dir: src('core'), entry: 'index.ts' }),
      // The browser-safe core entry is a FILE beside index.ts, not a directory.
      alias({ specifier: '@fromcode119/core/client', file: path.join(src('core'), 'client.ts') }),
      alias({ specifier: '@fromcode119/sdk', dir: src('sdk'), entry: 'index.ts' }),
      // The two database modules the client graph legitimately needs (pure naming utilities); the
      // package itself stays a server-only stub (see getServerOnlyStubPackages).
      alias({ specifier: '@fromcode119/database/physical-table-name-utils', file: path.join(src('database'), 'physical-table-name-utils.ts') }),
      alias({ specifier: '@fromcode119/database/naming-strategy', file: path.join(src('database'), 'naming-strategy.ts') }),
    ];
    const privatePrefixes = NextConfigEnv.PRIVATE_PACKAGE_ALIASES.map(([pkg, prefix]) =>
      alias({ specifier: prefix, dir: src(pkg), subpathsOnly: true }),
    );
    return [
      ...publicPackages,
      ...privatePrefixes,
      alias({ specifier: '@', dir: path.resolve(frontendDir), subpathsOnly: true }),
    ];
  }

  /**
   * One uniform alias record (every field present, empty when unused) so a TypeScript consumer of this
   * JS module sees ONE object type instead of a union of literal shapes.
   */
  static sourceAlias({ specifier, dir = '', entry = '', file = '', subpathsOnly = false }) {
    return { specifier, dir, entry, file, subpathsOnly };
  }

  /**
   * Server-only packages the client graph must NEVER resolve for real: each bare specifier maps to the
   * no-op stub (`getServerOnlyStubFile`). `express` is defense-in-depth — BaseRouter (and any plugin
   * code) must never reach a browser bundle.
   */
  static getServerOnlyStubPackages() {
    return [
      '@fromcode119/database',
      '@fromcode119/media',
      '@fromcode119/cache',
      '@fromcode119/email',
      '@fromcode119/scheduler',
      '@fromcode119/marketplace-client',
      '@fromcode119/plugins',
      'express',
    ];
  }

  /** Where the browser stand-ins live: core, shared by both apps and the runtime build. One class per file. */
  static getBrowserStubsDir() {
    return path.resolve(__dirname, '..', 'packages', 'core', 'src', 'browser-stubs');
  }

  /**
   * The stand-in module each server-only package resolves to in a browser build: a barrel of empty
   * classes named exactly like the values core imports from that package (so every bundler resolves the
   * names; nothing calls them). `express` has no browser-compiled importer, so it takes the empty module.
   */
  static getServerOnlyStubFiles() {
    const stubs = NextConfigEnv.getBrowserStubsDir();
    const empty = NextConfigEnv.getEmptyModuleFile();
    return Object.fromEntries(NextConfigEnv.getServerOnlyStubPackages().map((pkg) => {
      const name = pkg.startsWith('@fromcode119/') ? pkg.slice('@fromcode119/'.length) : '';
      return [pkg, name ? path.resolve(stubs, name, 'index.ts') : empty];
    }));
  }

  /**
   * Node built-ins that core/src server-only code imports and a browser build must neutralise.
   * `false` = an empty module (webpack `resolve.fallback` semantics; the runtime build aliases it to
   * `getEmptyModuleFile`); a string = a replacement module (async_hooks needs a real
   * `AsyncLocalStorage` shape because `RequestContext` instantiates one at class-evaluation time).
   */
  static getNodeBuiltinFallbacks() {
    return {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      url: false,
      util: false,
      module: false,
      'stream/promises': false,
      stream: false,
      zlib: false,
      net: false,
      tls: false,
      http: false,
      https: false,
      http2: false,
      child_process: false,
      worker_threads: false,
      async_hooks: path.resolve(NextConfigEnv.getBrowserStubsDir(), 'async-hooks', 'index.ts'),
    };
  }

  /** The empty module a `false` builtin fallback resolves to in a bundler with no `fallback` option. */
  static getEmptyModuleFile() {
    return path.resolve(NextConfigEnv.getBrowserStubsDir(), 'empty-module.ts');
  }

  /** `getSourceAliases` in turbopack `resolveAlias` shape (paths relative to the project dir). */
  static toTurbopackResolveAlias(aliases, frontendDir) {
    const rel = (target) => {
      const relative = path.relative(frontendDir, target).replace(/\\/g, '/');
      // `path.relative(dir, dir)` is '' — the frontend's own `@` prefix — which must render as `.`
      // (`'@/*': './*'`), not as `./` + `/*` = the malformed `.//*`.
      if (!relative) return '.';
      return relative.startsWith('.') ? relative : `./${relative}`;
    };
    const out = {};
    for (const alias of aliases) {
      if (alias.file) {
        out[alias.specifier] = rel(alias.file);
        continue;
      }
      if (!alias.subpathsOnly) out[alias.specifier] = rel(alias.dir);
      out[`${alias.specifier}/*`] = `${rel(alias.dir)}/*`;
    }
    return out;
  }

  /**
   * `getSourceAliases` in webpack `resolve.alias` shape.
   *
   * A `$`-anchored key is an EXACT match (single files, and the bare package -> its entry file). A
   * directory prefix is a PLAIN key: enhanced-resolve's AliasPlugin matches a plain key against the
   * request `name` and `name/<subpath>`. A key written with a trailing slash (`'@core/'`) only ever
   * matches `@core//x` — i.e. never — which is how the frontend's live `'@'` alias silently became inert
   * for one round. The exact key is emitted BEFORE the prefix key so the bare specifier resolves to the
   * entry file, not to the directory.
   */
  static toWebpackResolveAlias(aliases) {
    const out = {};
    for (const alias of aliases) {
      if (alias.file) {
        out[`${alias.specifier}$`] = alias.file;
        continue;
      }
      if (!alias.subpathsOnly) out[`${alias.specifier}$`] = path.join(alias.dir, alias.entry);
      out[alias.specifier] = alias.dir;
    }
    return out;
  }

  static parseCommaSeparatedValues(value) {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  static expandOriginCandidates(value) {
    const raw = String(value || '').trim();
    if (!raw) return [];

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const parsed = new URL(raw);
        return NextConfigEnv.unique([parsed.origin, parsed.hostname]);
      } catch {
        return [];
      }
    }

    return [raw.replace(/\/+$/, '')];
  }

  static toRemotePattern(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      const parsed = new URL(raw);
      return {
        protocol: parsed.protocol.replace(/:$/, ''),
        hostname: parsed.hostname,
      };
    } catch {
      return null;
    }
  }

  static deriveBasePathFromUrl(value, defaultPath = '') {
    const raw = String(value || '').trim();
    if (!raw) return NextConfigEnv.normalizePathPrefix(defaultPath);

    try {
      const parsed = new URL(raw);
      const normalizedPath = NextConfigEnv.normalizePathPrefix(parsed.pathname || '');
      if (!normalizedPath) {
        return NextConfigEnv.normalizePathPrefix(defaultPath);
      }

      const withoutVersion = normalizedPath.replace(/\/v[^/]+$/i, '');
      return NextConfigEnv.normalizePathPrefix(withoutVersion) || NextConfigEnv.normalizePathPrefix(defaultPath);
    } catch {
      return NextConfigEnv.normalizePathPrefix(defaultPath);
    }
  }

  static normalizePathPrefix(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '/') return '';
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  }

  static unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  static uniqueByKey(values, getKey) {
    const seen = new Set();
    const output = [];

    for (const value of values) {
      const key = getKey(value);
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push(value);
    }

    return output;
  }
}

NextConfigEnv.environmentInitialized = false;

/**
 * Each typescript-multiple-inheritance-built package's PRIVATE alias for its own `src` (`@core/x` -> `packages/core/src/x`), as
 * `[package, prefix]`. `next` is `@nextjs` because `@next` is a real npm scope in node_modules. This
 * mirrors the frontend tsconfig `paths` (which the TYPE-checker needs and cannot read from here); the
 * bundlers read this list.
 */
NextConfigEnv.PRIVATE_PACKAGE_ALIASES = [
  ['core', '@core'], ['database', '@database'], ['react', '@react'], ['api', '@api'], ['auth', '@auth'],
  ['cache', '@cache'], ['marketplace-client', '@marketplace-client'], ['media', '@media'], ['email', '@email'],
  ['scheduler', '@scheduler'], ['plugins', '@plugins'], ['mcp', '@mcp'], ['sdk', '@sdk'], ['next', '@nextjs'],
  ['cli', '@cli'],
];

module.exports = { NextConfigEnv };