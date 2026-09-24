/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { GuardScope } from './cli/guard-scope';
import { SdkBoundaryPatterns } from './sdk-boundary-patterns';

/**
 * Plugins and themes may import only `@fromcode119/sdk` — never core/database/api directly.
 *
 * Ported verbatim from the previous script — identical patterns, identical counts. Behaviour lives in
 * `run()`; splitting detection from reporting is a later refinement that must not change the numbers.
 */
export class SdkBoundaryGuard {
  /** Run the check; returns the process exit code (0 = clean). */
  static run(): number {

    const ROOT = process.cwd();
    // WHOSE code this checks. The rule is about plugins and themes, so the framework's own area is
    // never a target; a scoped run narrows it further to the single extension being guarded from its
    // own repository, and an unscoped run is both trees exactly as before.
    const TARGET_DIRS = GuardScope.areas(path.resolve(ROOT, '..', '..'))
      .filter((entry) => entry.area === 'plugins' || entry.area === 'themes')
      .map((entry) => entry.dir);
    if (!TARGET_DIRS.length) {
      console.log('[check-sdk-boundary] OK — no plugin or theme in scope.');
      return 0;
    }

    function walk(directoryPath: any) {
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      const files: any[] = [];
      for (const entry of entries) {
        const nextPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          files.push(...walk(nextPath));
          continue;
        }

        files.push(nextPath);
      }
      return files;
    }

    function shouldScan(filePath) {
      if (!SdkBoundaryPatterns.SOURCE_FILE_PATTERN.test(filePath) && !SdkBoundaryPatterns.JSON_FILE_PATTERN.test(filePath)) {
        return false;
      }

      return !SdkBoundaryPatterns.IGNORE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
    }

    function createLineState() {
      return {
        inBlockComment: false,
        inSingleQuote: false,
        inDoubleQuote: false,
        inTemplateLiteral: false,
      };
    }

    function stripCommentsFromLine(line, state) {
      if (SdkBoundaryPatterns.JSON_FILE_PATTERN.test(line)) {
        return { text: line, state };
      }

      let output = '';
      let index = 0;

      while (index < line.length) {
        const currentCharacter = line[index];
        const nextCharacter = line[index + 1];

        if (state.inBlockComment) {
          if (currentCharacter === '*' && nextCharacter === '/') {
            state.inBlockComment = false;
            index += 2;
            continue;
          }

          index += 1;
          continue;
        }

        if (!state.inSingleQuote && !state.inDoubleQuote && !state.inTemplateLiteral) {
          if (currentCharacter === '/' && nextCharacter === '*') {
            state.inBlockComment = true;
            index += 2;
            continue;
          }

          if (currentCharacter === '/' && nextCharacter === '/') {
            break;
          }
        }

        if (currentCharacter === '\\' && (state.inSingleQuote || state.inDoubleQuote || state.inTemplateLiteral)) {
          output += currentCharacter;
          if (index + 1 < line.length) {
            output += line[index + 1];
          }
          index += 2;
          continue;
        }

        if (!state.inDoubleQuote && !state.inTemplateLiteral && currentCharacter === '\'') {
          state.inSingleQuote = !state.inSingleQuote;
        } else if (!state.inSingleQuote && !state.inTemplateLiteral && currentCharacter === '"') {
          state.inDoubleQuote = !state.inDoubleQuote;
        } else if (!state.inSingleQuote && !state.inDoubleQuote && currentCharacter === '`') {
          state.inTemplateLiteral = !state.inTemplateLiteral;
        }

        output += currentCharacter;
        index += 1;
      }

      return {
        text: output,
        state,
      };
    }

    function collectLineViolations(filePath, lineText, lineNumber, ownPackageName) {
      const violations: any[] = [];
      const isPluginUiFile = SdkBoundaryPatterns.PLUGIN_UI_FILE_PATTERN.test(filePath);
      const isThemeSourceFile = SdkBoundaryPatterns.THEME_SOURCE_FILE_PATTERN.test(filePath);

      for (const match of lineText.matchAll(SdkBoundaryPatterns.IMPORT_PATTERN)) {
        // A package.json naming ITSELF with a scoped name is not a boundary
        // violation — only references to other framework packages are.
        if (ownPackageName && match[0] === ownPackageName) {
          continue;
        }

        // esbuild `--external:@fromcode119/...` flags in build scripts EXCLUDE the
        // package from the bundle — that is the boundary being enforced, not broken.
        if (lineText.slice(0, match.index).endsWith('--external:')) {
          continue;
        }

        violations.push({
          filePath,
          lineNumber,
          label: `forbidden package reference "${match[0]}"`,
        });
      }

      const isSeedFile = SdkBoundaryPatterns.SEED_FILE_PATTERN.test(filePath);
      for (const candidate of isSeedFile ? [] : SdkBoundaryPatterns.STRING_PATTERNS) {
        for (const match of lineText.matchAll(candidate.regex)) {
          // A match that directly continues an absolute `https?://…` token sits inside a
          // third-party service URL — out of scope for path-composition rules (see the flag).
          if (
            candidate.skipInAbsoluteUrl &&
            /https?:\/\/[^'"`\s]*$/.test(lineText.slice(0, match.index))
          ) {
            continue;
          }
          violations.push({
            filePath,
            lineNumber,
            label: candidate.label,
          });
        }
      }

      if ((isPluginUiFile || isThemeSourceFile) && !isSeedFile) {
        // Comments are stripped before this runs, so a match is a real literal in frontend code.
        for (const candidate of SdkBoundaryPatterns.FRONTEND_STRING_PATTERNS) {
          for (const match of lineText.matchAll(candidate.regex)) {
            violations.push({
              filePath,
              lineNumber,
              label: candidate.label,
            });
          }
        }
      }

      for (const candidate of SdkBoundaryPatterns.BROWSER_STATE_PATTERNS) {
        for (const match of lineText.matchAll(candidate.regex)) {
          violations.push({
            filePath,
            lineNumber,
            label: candidate.label,
          });
        }
      }

      return violations;
    }

    function readOwnPackageName(filePath, content) {
      if (!SdkBoundaryPatterns.JSON_FILE_PATTERN.test(filePath)) {
        return null;
      }

      try {
        const parsed = JSON.parse(content);
        return typeof parsed?.name === 'string' ? parsed.name : null;
      } catch {
        return null;
      }
    }

    function collectViolations(filePath, content) {
      const violations: any[] = [];
      const lineState = createLineState();
      const lines = content.split('\n');
      const ownPackageName = readOwnPackageName(filePath, content);

      lines.forEach((rawLine, index) => {
        const lineNumber = index + 1;
        const strippedLine = SdkBoundaryPatterns.JSON_FILE_PATTERN.test(filePath)
          ? rawLine
          : stripCommentsFromLine(rawLine, lineState).text;

        if (strippedLine.trim() === '') {
          return;
        }

        violations.push(...collectLineViolations(filePath, strippedLine, lineNumber, ownPackageName));
      });

      return violations;
    }

    const allViolations: any[] = [];

    for (const directoryPath of TARGET_DIRS) {
      if (!fs.existsSync(directoryPath)) {
        continue;
      }

      for (const filePath of walk(directoryPath)) {
        if (!shouldScan(filePath)) {
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        allViolations.push(...collectViolations(filePath, content));
      }
    }

    if (allViolations.length > 0) {
      console.error('[check-sdk-boundary] Found plugin/theme SDK boundary violations:\n');
      for (const violation of allViolations) {
        const relativePath = path.relative(ROOT, violation.filePath) || violation.filePath;
        console.error(`- ${relativePath}:${violation.lineNumber} ${violation.label}`);
      }
      return 1;
    }

    console.log('[check-sdk-boundary] OK');

    return 0;
  }
}
