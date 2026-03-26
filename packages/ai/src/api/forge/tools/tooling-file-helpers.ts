import { ProjectPaths } from '@fromcode119/core';
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
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.md', '.mdx', '.txt', '.yml', '.yaml', '.toml', '.xml', '.svg', '.njk', '.liquid', '.hbs', '.mustache', '.ejs',
  '.php', '.twig', '.ini', '.conf', '.env', '.sql', '.graphql', '.gql', '.vue', '.svelte',
]);

export class AssistantToolingFileHelpers {
  static scopeRoot(scope: 'plugins' | 'themes'): string {
    return path.resolve(ProjectPaths.getProjectRoot(), scope);
  }

  static normalizeRelativePath(baseDir: string, fullPath: string): string {
    return path.relative(baseDir, fullPath).split(path.sep).join('/');
  }

  static isPathWithin(baseDir: string, fullPath: string): boolean {
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(fullPath);
    const relative = path.relative(resolvedBase, resolvedPath);
    return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  static isTextFilePath(filePath: string): boolean {
    const extension = path.extname(String(filePath || '')).toLowerCase();
    if (TEXT_FILE_EXTENSIONS.has(extension)) return true;
    const basename = path.basename(String(filePath || '')).toLowerCase();
    return basename === '.env' || basename.startsWith('.env.');
  }

  static listScopeFiles(baseDir: string, maxFiles: number): string[] {
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

        if (entry.isFile() && this.isTextFilePath(entryPath)) {
          output.push(entryPath);
        }
      }
    }

    return output;
  }

  static searchTextInFile(
    filePath: string,
    query: string,
    maxMatches: number,
    normalizeSearchText: (value: string) => string,
    tokenizeSearchQuery: (value: string) => string[],
    textMatchesQuery: (value: string, queryLower: string, queryTokens: string[]) => boolean,
  ): Array<{ line: number; column: number; value: string }> {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) return [];

    const queryLower = normalizeSearchText(query);
    const queryTokens = tokenizeSearchQuery(query);
    const lines = content.split(/\r?\n/);
    const matches: Array<{ line: number; column: number; value: string }> = [];

    for (let index = 0; index < lines.length; index += 1) {
      if (matches.length >= maxMatches) break;
      const line = String(lines[index] || '');
      if (!textMatchesQuery(line, queryLower, queryTokens)) continue;

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

  static buildAssistantFileBackupPath(filePath: string, stamp?: string): string {
    const projectRoot = ProjectPaths.getProjectRoot();
    const relative = path.relative(projectRoot, filePath).split(path.sep).join('/');
    const normalizedRelative = relative && !relative.startsWith('..') ? relative : path.basename(filePath);
    const safeStamp = String(stamp || new Date().toISOString()).replace(/[^0-9a-z_-]+/gi, '-');
    return path.resolve(projectRoot, 'backups', 'assistant-files', safeStamp, `${normalizedRelative}.bak`);
  }

  static writeAssistantFileBackup(filePath: string): string {
    const backupPath = this.buildAssistantFileBackupPath(filePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }

  static escapeRegExp(text: string): string {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
