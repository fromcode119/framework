import { PluginManager, ThemeManager } from '@fromcode119/core';
import * as fs from 'fs';
import * as path from 'path';
import { AssistantToolingFileHelpers } from './tooling-file-helpers';
import { AssistantToolingObjectHelpers } from './tooling-object-helpers';
import { AssistantToolingTextHelpers } from './tooling-text-helpers';

const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const DEFAULT_PREVIEW_CHARS = 280;

export class AssistantToolingHelpers {
  constructor(private readonly manager: PluginManager, private readonly themeManager: ThemeManager) {}

  public normalizeSearchText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public toAssistantSlug(value: string, fallback: string = 'item'): string {
    return AssistantToolingObjectHelpers.toAssistantSlug(value, fallback);
  }

  public toAssistantTitle(value: string, fallback: string): string {
    return AssistantToolingObjectHelpers.toAssistantTitle(value, fallback);
  }

  public readPluginConfig(slug: string): Record<string, any> {
    return AssistantToolingObjectHelpers.readPluginConfig(this.manager, slug);
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
    return AssistantToolingObjectHelpers.collectObjectStringMatches(
      value,
      queryLower,
      queryTokens,
      basePath,
      this.collectObjectStringMatches.bind(this),
      this.textMatchesQuery.bind(this),
      this.isPotentialLocaleKey.bind(this),
      depth,
      maxDepth,
    );
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

    if (matches.length >= maxMatches || scannedFiles >= maxFiles) truncated = true;
    return { matches, totalMatches: matches.length, scannedFiles, truncated };
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
    return AssistantToolingTextHelpers.isPotentialLocaleKey(key);
  }

  private tokenVariants(token: string): string[] {
    return AssistantToolingTextHelpers.tokenVariants(token);
  }

  private textMatchesQuery(value: string, queryLower: string, queryTokens: string[]): boolean {
    return AssistantToolingTextHelpers.textMatchesQuery(
      value,
      queryLower,
      queryTokens,
      this.normalizeSearchText.bind(this),
    );
  }

  private scopeRoot(scope: 'plugins' | 'themes'): string {
    return AssistantToolingFileHelpers.scopeRoot(scope);
  }

  private normalizeRelativePath(baseDir: string, fullPath: string): string {
    return AssistantToolingFileHelpers.normalizeRelativePath(baseDir, fullPath);
  }

  private isPathWithin(baseDir: string, fullPath: string): boolean {
    return AssistantToolingFileHelpers.isPathWithin(baseDir, fullPath);
  }

  private isTextFilePath(filePath: string): boolean {
    return AssistantToolingFileHelpers.isTextFilePath(filePath);
  }

  private listScopeFiles(baseDir: string, maxFiles: number): string[] {
    return AssistantToolingFileHelpers.listScopeFiles(baseDir, maxFiles);
  }

  private searchTextInFile(options: {
    filePath: string;
    query: string;
    maxMatches: number;
  }): Array<{ line: number; column: number; value: string }> {
    const { filePath, query, maxMatches } = options;
    return AssistantToolingFileHelpers.searchTextInFile(
      filePath,
      query,
      maxMatches,
      this.normalizeSearchText.bind(this),
      this.tokenizeSearchQuery.bind(this),
      this.textMatchesQuery.bind(this),
    );
  }

  private buildAssistantFileBackupPath(filePath: string, stamp?: string): string {
    return AssistantToolingFileHelpers.buildAssistantFileBackupPath(filePath, stamp);
  }

  private writeAssistantFileBackup(filePath: string): string {
    return AssistantToolingFileHelpers.writeAssistantFileBackup(filePath);
  }

  private escapeRegExp(text: string): string {
    return AssistantToolingFileHelpers.escapeRegExp(text);
  }
}
