import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';


/**
 * Move every `*.client.*` module into a `view/` folder beside the feature that owns it, rewriting
 * every import that referenced it.
 *
 * The `.client.` filename is the client-boundary marker (`'use client'` never appears in source), and
 * the convention is that those front-facing modules sit in their own `view/` folder rather than beside
 * the server code they pair with:
 *
 *   app/users/[id]/security/page.tsx
 *   app/users/[id]/security/view/security-panel.client.tsx
 *
 * NEVER MOVED — Next route entries. Both Next configs put `client.tsx`/`client.ts` in `pageExtensions`,
 * so `page.client.tsx` IS the route's `page` and `layout.client.tsx` IS its layout. Moving one into
 * `view/` would relocate the route itself (`/users` → `/users/view`) — a silent, total breakage that
 * every type gate would still report green. {@link ROUTE_ENTRIES} is that exclusion list.
 *
 * Imports are rewritten by the TypeScript language service (`getEditsForFileRename`), never by regex:
 * the packages resolve through private `@pkg/` path aliases, so the correct new specifier is whatever
 * the alias map says it is, not a computed relative path.
 */
export class ClientViewMove {
  /** Folder a moved client module lands in, relative to where it currently sits. */
  static readonly VIEW_DIR = 'view';

  /**
   * Next.js special filenames. With `client.tsx` in `pageExtensions`, `page.client.tsx` and friends are
   * ROUTE ENTRIES — their directory IS their URL. They stay exactly where they are.
   */
  static readonly ROUTE_ENTRIES: readonly string[] = [
    'page', 'layout', 'template', 'loading', 'error', 'not-found', 'global-error', 'default', 'route',
  ];

  private static readonly SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', 'coverage']);

  /** Every `.ts`/`.tsx` file under `dir`, excluding build output. */
  static walk(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string) => {
      for (const entry of readdirSync(current)) {
        if (ClientViewMove.SKIP_DIRS.has(entry)) continue;
        const full = path.join(current, entry);
        if (statSync(full).isDirectory()) visit(full);
        else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
      }
    };
    visit(dir);
    return out;
  }

  /** True when this file is a Next route entry and must not move. */
  static isRouteEntry(file: string): boolean {
    const base = path.basename(file);
    const stem = base.slice(0, base.indexOf('.client.'));
    return ClientViewMove.ROUTE_ENTRIES.includes(stem);
  }

  /**
   * Resolution settings for the rename, read from the framework's ROOT tsconfig.
   *
   * It must be that file and not `WorkspaceTypecheck.compilerOptions`: every typor-built package
   * carries a PRIVATE `@core/`-style alias for its own source, and the whole map is declared there.
   * Without it the language service cannot resolve `@core/localized-field.client`, finds no importers,
   * and reports "0 files would be rewritten" — a move that silently breaks every referring import
   * while the tool claims success. `@/*` is admin's own alias and is added on top.
   */
  static compilerOptions(framework: string, target?: string): ts.CompilerOptions {
    const configPath = path.join(framework, 'tsconfig.json');
    const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config ?? {}, ts.sys, framework);
    // `@/*` is NOT global — it is each Next app's alias for its OWN root, and admin and frontend both
    // define it. Pointing it at a fixed package makes the other app's imports resolve into the wrong
    // tree, so the language service finds no importers and reports "0 rewritten" on a move that has
    // in fact broken every one of them. It is bound to whichever package is being processed.
    const pkg = target ? String(target.split(path.sep).join('/').match(/(.*\/packages\/[^/]+)/)?.[1] ?? '') : '';
    return {
      ...parsed.options,
      baseUrl: framework,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: true,
      noEmit: true,
      paths: {
        ...(parsed.options.paths ?? {}),
        ...(pkg ? { '@/*': [path.join(pkg, '*')] } : {}),
      },
    };
  }

  /**
   * package directory → its PRIVATE source alias, derived from the root tsconfig (`@core/*` →
   * `packages/core/src/*` yields `core → @core`).
   *
   * Needed because the public `@fromcode119/core/*` and the private `@core/*` mappings resolve to the
   * SAME directory, and the language service happily emits either. Left alone it rewrites an in-package
   * `@core/x` into `@fromcode119/core/x`, which routes a package's own source through its public entry
   * and breaks the "private alias for in-package imports" convention.
   */
  static privateAliases(framework: string, target?: string): Map<string, string> {
    const paths = (ClientViewMove.compilerOptions(framework, target).paths ?? {}) as Record<string, string[]>;
    const out = new Map<string, string>();
    for (const [pattern, targets] of Object.entries(paths)) {
      const alias = pattern.match(/^@([a-z0-9-]+)\/\*$/)?.[1];
      if (!alias || alias === 'fromcode119') continue;
      const pkg = String(targets[0] ?? '').match(/packages[\\/]([^\\/]+)[\\/]src[\\/]\*$/)?.[1];
      if (pkg) out.set(pkg, `@${alias}`);
    }
    return out;
  }

  /**
   * Rewrite a specifier the language service produced so an in-package import keeps using that
   * package's PRIVATE alias instead of its public `@fromcode119/<pkg>` entry.
   */
  static preferPrivateAlias(newText: string, importingFile: string, aliases: Map<string, string>): string {
    // Unanchored and global: `newText` is whatever the language service chose to replace — sometimes
    // the bare specifier, sometimes the quoted one, sometimes a whole import clause. Matching the
    // package segment anywhere in it covers all three.
    const posix = importingFile.split(path.sep).join('/');
    return newText.replace(/@fromcode119\/([a-z0-9-]+)\//g, (whole, pkg: string) => {
      const alias = aliases.get(pkg);
      return alias && posix.includes(`/packages/${pkg}/`) ? `${alias}/` : whole;
    });
  }

  /** The client modules under `dir` that should move, as `{ from, to }` pairs. */
  static plan(dir: string): Array<{ from: string; to: string }> {
    return ClientViewMove.walk(dir)
      .filter((f) => path.basename(f).includes('.client.'))
      .filter((f) => !ClientViewMove.isRouteEntry(f))
      // already in a view/ folder — nothing to do
      .filter((f) => path.basename(path.dirname(f)) !== ClientViewMove.VIEW_DIR)
      .map((from) => ({
        from,
        to: path.join(path.dirname(from), ClientViewMove.VIEW_DIR, path.basename(from)),
      }));
  }

  /**
   * Move the planned files and rewrite every referring import.
   *
   * `roots` are the directories whose sources take part in resolution — pass the packages that may
   * import from `dir`, or an import in a sibling package is left pointing at the old path.
   */
  static run(
    dir: string,
    framework: string,
    roots: string[],
    apply = true,
  ): { moved: string[]; edited: string[]; skipped: string[] } {
    const moves = ClientViewMove.plan(dir);
    if (!moves.length) return { moved: [], edited: [], skipped: ['nothing to move'] };

    const files = Array.from(new Set(roots.flatMap((r) => ClientViewMove.walk(r))));
    const options = ClientViewMove.compilerOptions(framework, dir);

    const contents = new Map<string, string>();
    for (const file of files) contents.set(file, readFileSync(file, 'utf8'));
    const versions = new Map<string, number>(files.map((f) => [f, 0]));
    let scriptNames = [...files];

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => scriptNames,
      getScriptVersion: (f) => String(versions.get(f) ?? 0),
      getScriptSnapshot: (f) => {
        const text = contents.get(f) ?? ts.sys.readFile(f);
        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => framework,
      getCompilationSettings: () => options,
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      fileExists: (f) => contents.has(f) || ts.sys.fileExists(f),
      readFile: (f) => contents.get(f) ?? ts.sys.readFile(f),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };
    const service = ts.createLanguageService(host, ts.createDocumentRegistry());
    if (!service.getProgram()) return { moved: [], edited: [], skipped: ['could not create a program'] };

    const aliases = ClientViewMove.privateAliases(framework, dir);
    const moved: string[] = [];
    const skipped: string[] = [];
    const applied: Array<{ from: string; to: string }> = [];
    // CURRENT paths of files whose text changed. A file can be edited and then itself moved by a later
    // rename, so this set is re-keyed on every move — writing a stale path is what made the first
    // version of this tool crash half-way through, leaving imports rewritten but files unmoved.
    const dirty = new Set<string>();

    for (const { from, to } of moves) {
      if (existsSync(to)) { skipped.push(`${path.relative(framework, to)}: target already exists`); continue; }

      // Ask the language service what every importer must now say. This must run BEFORE the file
      // moves on disk, while the old path is still the resolved one.
      const changes = service.getEditsForFileRename(from, to, {}, {});
      for (const change of changes) {
        const target = change.fileName;
        const before = contents.get(target) ?? ts.sys.readFile(target);
        if (before === undefined) { skipped.push(`${path.relative(framework, target)}: unreadable`); continue; }
        // back-to-front so earlier spans keep their offsets
        const ordered = [...change.textChanges].sort((a, b) => b.span.start - a.span.start);
        let after = before;
        for (const edit of ordered) {
          const text = ClientViewMove.preferPrivateAlias(edit.newText, target, aliases);
          after = after.slice(0, edit.span.start) + text + after.slice(edit.span.start + edit.span.length);
        }
        contents.set(target, after);
        versions.set(target, (versions.get(target) ?? 0) + 1);
        dirty.add(target);
      }

      // Keep the in-memory project consistent with the move so the NEXT rename resolves against the
      // new layout rather than a path that no longer exists.
      const text = contents.get(from);
      if (text !== undefined) { contents.set(to, text); contents.delete(from); }
      if (dirty.delete(from)) dirty.add(to);
      versions.set(to, 0);
      scriptNames = scriptNames.map((f) => (f === from ? to : f));
      applied.push({ from, to });
      moved.push(`${path.relative(framework, from)} → ${path.relative(framework, to)}`);
    }

    // A module nothing imports is possible; a whole PACKAGE of them is not. "Files moved, nothing
    // rewritten" is the exact signature of a path alias the language service could not resolve — it
    // then finds no importers and reports success while every import is left pointing at a path that
    // no longer exists. Both real failures of this tool looked exactly like this, so it refuses.
    if (applied.length > 1 && dirty.size === 0) {
      return {
        moved: [],
        edited: [],
        skipped: [
          `REFUSED: ${applied.length} file(s) would move but NO importer was rewritten — a path alias `
          + `almost certainly failed to resolve. Nothing was written. Check that the package's own `
          + `alias (e.g. '@/*') is bound to this package in ClientViewMove.compilerOptions.`,
        ],
      };
    }

    if (apply) {
      // Move first (creating each target directory), THEN write. Writing a moved file's new path
      // before its directory exists is an ENOENT mid-run, and a partial run is the worst outcome:
      // importers already rewritten, files still at their old paths.
      for (const { from, to } of applied) {
        if (!existsSync(from)) continue;
        mkdirSync(path.dirname(to), { recursive: true });
        renameSync(from, to);
      }
      for (const file of dirty) writeFileSync(file, contents.get(file)!, 'utf8');
    }

    return { moved, edited: [...dirty].map((f) => path.relative(framework, f)), skipped };
  }
}
