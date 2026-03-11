import { ProjectPaths, PluginManager, ThemeManager } from '@fromcode119/core';
import * as fs from 'fs';
import * as path from 'path';

const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const DEFAULT_PREVIEW_CHARS = 280;
const SKIP_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  'backups',
  'tmp',
  'temp',
]);
const TEXT_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.md',
  '.mdx',
  '.txt',
  '.yml',
  '.yaml',
  '.toml',
  '.xml',
  '.svg',
  '.njk',
  '.liquid',
  '.hbs',
  '.mustache',
  '.ejs',
  '.php',
  '.twig',
  '.ini',
  '.conf',
  '.env',
  '.sql',
  '.graphql',
  '.gql',
  '.vue',
  '.svelte',
]);

export class AssistantToolingHelpers {
  constructor(
    private readonly manager: PluginManager,
    private readonly themeManager: ThemeManager,
  ) {}

  public normalizeSearchText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public toAssistantSlug(value: string, fallback: string = 'item'): string {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  public toAssistantTitle(value: string, fallback: string): string {
    const text = String(value || '').trim();
    return text || fallback;
  }

  public readPluginConfig(slug: string): Record<string, any> {
    const plugin = this.manager
      .getPlugins()
      .find((entry: any) => String(entry?.manifest?.slug || '').trim().toLowerCase() === slug);
    const config = plugin?.manifest?.config;
    return config && typeof config === 'object' ? { ...config } : {};
  }

  public tokenizeSearchQuery(query: string): string[] {
    return this.normalizeSearchText(query)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }

  public collectObjectStringMatches(
    value: any,
    queryLower: string,
    queryTokens: string[],
    basePath: string,
    depth: number = 0,
    maxDepth: number = 5,
  ): Array<{ path: string; value: string }> {
    if (depth > maxDepth) return [];
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
      if (!this.textMatchesQuery(value, queryLower, queryTokens)) return [];
      return [{ path: basePath || 'value', value }];
    }

    if (Array.isArray(value)) {
      const output: Array<{ path: string; value: string }> = [];
      for (let index = 0; index < value.length; index += 1) {
        const nextPath = `${basePath}[${index}]`;
        output.push(
          ...this.collectObjectStringMatches(value[index], queryLower, queryTokens, nextPath, depth + 1, maxDepth),
        );
      }
      return output;
    }

    if (typeof value === 'object') {
      const output: Array<{ path: string; value: string }> = [];
      for (const [rawKey, nestedValue] of Object.entries(value)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        if (key.startsWith('_')) continue;
        const keySegment = this.isPotentialLocaleKey(key) ? `[${key}]` : key;
        const nextPath = basePath ? `${basePath}.${keySegment}` : keySegment;
        output.push(
          ...this.collectObjectStringMatches(nestedValue, queryLower, queryTokens, nextPath, depth + 1, maxDepth),
        );
      }
      return output;
    }

    return [];
  }

  public searchScopeFiles(options: {
    scope: 'plugins' | 'themes';
    query: string;
    slug?: string;
    maxMatches: number;
    maxFiles: number;
  }): {
    matches: Array<{ slug: string; path: string; relativePath: string; line: number; column: number; value: string }>;
    totalMatches: number;
    scannedFiles: number;
    truncated: boolean;
  } {
    const { scope, query, slug, maxMatches, maxFiles } = options;
    const scopeRoot = this.scopeRoot(scope);
    const baseDirs: Array<{ slug: string; dir: string }> = [];

    if (slug) {
      const scopedDir = path.resolve(scopeRoot, slug);
      if (!this.isPathWithin(scopeRoot, scopedDir)) {
        throw new Error(`Invalid ${scope} slug`);
      }
      if (fs.existsSync(scopedDir) && fs.statSync(scopedDir).isDirectory()) {
        baseDirs.push({ slug, dir: scopedDir });
      }
    } else if (fs.existsSync(scopeRoot)) {
      const entries = fs.readdirSync(scopeRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry?.isDirectory()) continue;
        const entrySlug = this.toAssistantSlug(String(entry.name || ''), '');
        if (!entrySlug) continue;
        baseDirs.push({ slug: entrySlug, dir: path.join(scopeRoot, entry.name) });
      }
    }

    const matches: Array<{ slug: string; path: string; relativePath: string; line: number; column: number; value: string }> = [];
    let scannedFiles = 0;
    let truncated = false;

    for (const entry of baseDirs) {
      if (matches.length >= maxMatches || scannedFiles >= maxFiles) break;
      const files = this.listScopeFiles(entry.dir, Math.max(1, maxFiles - scannedFiles));
      for (const filePath of files) {
        if (matches.length >= maxMatches || scannedFiles >= maxFiles) break;
        scannedFiles += 1;
        let lineMatches: Array<{ line: number; column: number; value: string }> = [];
        try {
          lineMatches = this.searchTextInFile({
            filePath,
            query,
            maxMatches: Math.max(1, maxMatches - matches.length),
          });
        } catch {
          continue;
        }
        for (const lineMatch of lineMatches) {
          if (matches.length >= maxMatches) break;
          matches.push({
            slug: entry.slug,
            path: filePath,
            relativePath: this.normalizeRelativePath(scopeRoot, filePath),
            line: lineMatch.line,
            column: lineMatch.column,
            value: lineMatch.value,
          });
        }
      }
    }

    if (matches.length >= maxMatches || scannedFiles >= maxFiles) {
      truncated = true;
    }

    return {
      matches,
      totalMatches: matches.length,
      scannedFiles,
      truncated,
    };
  }

  public scopeSlugFromPath(scope: 'plugins' | 'themes', filePath: string): string | null {
    const scopeRoot = this.scopeRoot(scope);
    const relative = this.normalizeRelativePath(scopeRoot, filePath);
    if (!relative || relative.startsWith('../')) return null;
    const [slug] = relative.split('/');
    return slug ? this.toAssistantSlug(slug, '') : null;
  }

  public resolveScopedFilePath(scope: 'plugins' | 'themes', slug: string, filePathInput: string): string {
    const scopeRoot = this.scopeRoot(scope);
    let resolvedPath = '';

    if (filePathInput) {
      resolvedPath = path.isAbsolute(filePathInput)
        ? path.resolve(filePathInput)
        : slug
          ? path.resolve(scopeRoot, slug, filePathInput)
          : path.resolve(scopeRoot, filePathInput);
    } else if (slug) {
      throw new Error('Missing file path');
    } else {
      throw new Error(`Missing ${scope} slug or file path`);
    }

    if (!this.isPathWithin(scopeRoot, resolvedPath)) {
      throw new Error(`File path must stay within ${scope} directory`);
    }
    if (slug) {
      const scopedRoot = path.resolve(scopeRoot, slug);
      if (!this.isPathWithin(scopedRoot, resolvedPath)) {
        throw new Error(`File path must stay within ${scope}/${slug}`);
      }
    }
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      throw new Error('Target file not found');
    }
    if (!this.isTextFilePath(resolvedPath)) {
      throw new Error('Target file is not a supported text file');
    }
    return resolvedPath;
  }

  public replaceTextInFile(options: {
    filePath: string;
    from: string;
    to: string;
    caseSensitive: boolean;
    dryRun: boolean;
  }): {
    path: string;
    changed: boolean;
    replacements: number;
    beforeSnippet: string;
    afterSnippet: string;
    backupPath?: string;
    plannedBackupPath?: string;
  } {
    const { filePath, from, to, caseSensitive, dryRun } = options;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) {
      throw new Error('Target file is too large for safe assistant replacement');
    }
    const source = fs.readFileSync(filePath, 'utf8');
    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = new RegExp(this.escapeRegExp(from), flags);
    const replacements = (source.match(pattern) || []).length;
    if (replacements === 0) {
      return {
        path: filePath,
        changed: false,
        replacements: 0,
        beforeSnippet: '',
        afterSnippet: '',
      };
    }

    const replaced = source.replace(pattern, to);
    const fromIndex = source.toLowerCase().indexOf(from.toLowerCase());
    const previewStart = Math.max(0, fromIndex - 80);
    const beforeSnippet = source.slice(previewStart, Math.min(source.length, previewStart + DEFAULT_PREVIEW_CHARS));
    const afterSnippet = replaced.slice(previewStart, Math.min(replaced.length, previewStart + DEFAULT_PREVIEW_CHARS));
    const plannedBackupPath = this.buildAssistantFileBackupPath(filePath);
    let backupPath: string | undefined;

    if (!dryRun) {
      backupPath = this.writeAssistantFileBackup(filePath);
      fs.writeFileSync(filePath, replaced, 'utf8');
    }

    return {
      path: filePath,
      changed: true,
      replacements,
      beforeSnippet,
      afterSnippet,
      backupPath,
      plannedBackupPath: dryRun ? plannedBackupPath : undefined,
    };
  }

  private isPotentialLocaleKey(key: string): boolean {
    return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(String(key || '').trim());
  }

  private tokenVariants(token: string): string[] {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return [];
    const variants = new Set<string>([normalized]);
    if (normalized.endsWith('s') && normalized.length > 3) {
      variants.add(normalized.slice(0, -1));
    } else if (!normalized.endsWith('s') && normalized.length > 3) {
      variants.add(`${normalized}s`);
    }
    return Array.from(variants);
  }

  private textMatchesQuery(value: string, queryLower: string, queryTokens: string[]): boolean {
    const normalized = this.normalizeSearchText(value);
    if (!normalized) return false;
    if (queryLower && normalized.includes(queryLower)) return true;
    if (!queryTokens.length) return false;
    return queryTokens.every((token) => this.tokenVariants(token).some((variant) => normalized.includes(variant)));
  }

  private scopeRoot(scope: 'plugins' | 'themes'): string {
    return path.resolve(ProjectPaths.getProjectRoot(), scope);
  }

  private normalizeRelativePath(baseDir: string, fullPath: string): string {
    const relative = path.relative(baseDir, fullPath);
    return relative.split(path.sep).join('/');
  }

  private isPathWithin(baseDir: string, fullPath: string): boolean {
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(fullPath);
    const relative = path.relative(resolvedBase, resolvedPath);
    return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  private isTextFilePath(filePath: string): boolean {
    const extension = path.extname(String(filePath || '')).toLowerCase();
    if (TEXT_FILE_EXTENSIONS.has(extension)) return true;
    const basename = path.basename(String(filePath || '')).toLowerCase();
    if (basename === '.env' || basename.startsWith('.env.')) return true;
    return false;
  }

  private listScopeFiles(baseDir: string, maxFiles: number): string[] {
    if (!fs.existsSync(baseDir)) return [];
    const output: string[] = [];
    const stack = [baseDir];

    while (stack.length > 0 && output.length < maxFiles) {
      const currentDir = stack.pop() as string;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (output.length >= maxFiles) break;
        const entryName = String(entry?.name || '').trim();
        if (!entryName) continue;
        const entryPath = path.join(currentDir, entryName);

        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entryName)) continue;
          stack.push(entryPath);
          continue;
        }

        if (!entry.isFile()) continue;
        if (!this.isTextFilePath(entryPath)) continue;
        output.push(entryPath);
      }
    }

    return output;
  }

  private searchTextInFile(options: {
    filePath: string;
    query: string;
    maxMatches: number;
  }): Array<{ line: number; column: number; value: string }> {
    const { filePath, query, maxMatches } = options;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) return [];

    const queryLower = this.normalizeSearchText(query);
    const queryTokens = this.tokenizeSearchQuery(query);
    const lines = content.split(/\r?\n/);
    const matches: Array<{ line: number; column: number; value: string }> = [];

    for (let index = 0; index < lines.length; index += 1) {
      if (matches.length >= maxMatches) break;
      const line = String(lines[index] || '');
      if (!this.textMatchesQuery(line, queryLower, queryTokens)) continue;

      const lowerLine = line.toLowerCase();
      const lowerQuery = String(query || '').toLowerCase();
      const columnIndex = lowerQuery ? lowerLine.indexOf(lowerQuery) : -1;
      matches.push({
        line: index + 1,
        column: columnIndex >= 0 ? columnIndex + 1 : 1,
        value: line.length > DEFAULT_PREVIEW_CHARS ? `${line.slice(0, DEFAULT_PREVIEW_CHARS)}...` : line,
      });
    }

    return matches;
  }

  private buildAssistantFileBackupPath(filePath: string, stamp?: string): string {
    const projectRoot = ProjectPaths.getProjectRoot();
    const relative = path.relative(projectRoot, filePath).split(path.sep).join('/');
    const normalizedRelative = relative && !relative.startsWith('..') ? relative : path.basename(filePath);
    const safeStamp = String(stamp || new Date().toISOString()).replace(/[^0-9a-z_-]+/gi, '-');
    return path.resolve(projectRoot, 'backups', 'assistant-files', safeStamp, `${normalizedRelative}.bak`);
  }

  private writeAssistantFileBackup(filePath: string): string {
    const backupPath = this.buildAssistantFileBackupPath(filePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }

  private escapeRegExp(text: string): string {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}