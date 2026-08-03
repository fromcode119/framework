/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Audits what reaches into core internals from outside.
 *
 * Ported verbatim from the previous script — identical patterns, identical counts. Behaviour lives in
 * `run()`; splitting detection from reporting is a later refinement that must not change the numbers.
 */
export class CoreBoundaryAudit {
  /** Run the check; returns the process exit code (0 = clean). */
  static run(): number {

    const ROOT = process.cwd();
    const SOURCE_DIRS = [
      path.join(ROOT, 'packages', 'api', 'src'),
      path.join(ROOT, 'packages', 'admin', 'app'),
      path.join(ROOT, 'packages', 'admin', 'components'),
      path.join(ROOT, 'packages', 'admin', 'lib'),
      path.join(ROOT, 'packages', 'sdk', 'src')
    ];

    const ALLOWED_PATH_MATCHERS = [
      /\/packages\/admin\/app\/plugins\//,
      /\/packages\/admin\/app\/themes\//
    ];

    function escapeRegex(value) {
      return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalizeToken(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '')
        .replace(/^fromcode[-_/]*/i, '')
        .replace(/^plugin[-_/]*/i, '')
        .replace(/^theme[-_/]*/i, '');
    }

    function readJson(filePath) {
      try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null;
      }
    }

    function collectPluginTokens() {
      const roots = [
        process.env.PLUGINS_DIR,
        path.resolve(ROOT, '..', '..', 'plugins')
      ].filter(Boolean);

      const tokens = new Set<any>();

      for (const pluginsRoot of roots as string[]) {
        if (!fs.existsSync(pluginsRoot)) continue;
        const entries = fs.readdirSync(pluginsRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dir = path.join(pluginsRoot, entry.name);
          const manifest = readJson(path.join(dir, 'manifest.json'));
          const pkg = readJson(path.join(dir, 'package.json'));
          const candidates = [
            manifest?.slug,
            pkg?.name
          ];
          for (const candidate of candidates) {
            const token = normalizeToken(candidate);
            if (!token || token.length < 2) continue;
            tokens.add(token);
          }
        }
      }

      return Array.from(tokens);
    }

    function buildTokenPatterns(tokens) {
      const patterns: any[] = [];
      for (const token of tokens) {
        const escaped = escapeRegex(token);
        const separatorFlexible = escaped.replace(/[-_ ]+/g, '[-_ ]?');
        patterns.push(new RegExp(`\\b${separatorFlexible}[-_/][a-z0-9_]`, 'i'));
        patterns.push(new RegExp(`\\b[a-z0-9_]+[-_/]${separatorFlexible}\\b`, 'i'));
        patterns.push(new RegExp(`@${separatorFlexible}(?:\\b|/)`, 'i'));
      }
      return patterns;
    }

    function walk(dir: any, out: any[] = []) {
      if (!fs.existsSync(dir)) return out;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
            continue;
          }
          walk(full, out);
          continue;
        }
        if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
        if (/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
        out.push(full);
      }
      return out;
    }

    function isAllowedPath(filePath) {
      return ALLOWED_PATH_MATCHERS.some((matcher) => matcher.test(filePath));
    }

    const findings: any[] = [];
    const pluginTokens = collectPluginTokens();
    const BANNED_PATTERNS = buildTokenPatterns(pluginTokens);
    for (const sourceDir of SOURCE_DIRS) {
      for (const filePath of walk(sourceDir)) {
        if (isAllowedPath(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          for (const pattern of BANNED_PATTERNS) {
            if (!pattern.test(line)) continue;
            findings.push({
              file: path.relative(ROOT, filePath),
              line: index + 1,
              text: line.trim()
            });
            break;
          }
        });
      }
    }

    if (findings.length) {
      console.error('[core-boundary] Plugin-specific terms found in framework core files:');
      for (const finding of findings) {
        console.error(`- ${finding.file}:${finding.line} -> ${finding.text}`);
      }
      return 1;
    }

    console.log('[core-boundary] OK: no plugin-specific coupling found in api/admin/sdk core sources.');

    return 0;
  }
}
