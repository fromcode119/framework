import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.resolve(ROOT, '../../plugins'),
  path.resolve(ROOT, '../../themes'),
];
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const JSON_FILE_PATTERN = /\/package\.json$/;
const IGNORE_PATH_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\/ui\/bundle\.js$/,
  /\/bundle\.js$/,
  /\/index\.js$/,
  /\/seed-old\.ts$/,
  // Built artifacts — not source code:
  // - themes/<slug>/ui/** holds the Vite build output (hashed chunks like
  //   vendor-chakra-XXXXXXXX.js); the corresponding source lives in src/.
  // - frontend.js is an esbuild bundle output by convention (like bundle.js).
  /\/themes\/[^/]+\/ui\//,
  /\/frontend\.js$/,
  // build-server is privileged build infrastructure: it packs OTHER plugins, so
  // framework package names appear in its esbuild `external` arrays as data, and
  // it resolves core's IntegrityService to stamp checksums. It is not a normal
  // plugin and is exempt from the SDK boundary.
  /\/plugins\/build-server\//,
];

const IMPORT_PATTERN = /@fromcode119\/(?!sdk(?:\/|['"\s]|$))[A-Za-z0-9._/-]+/g;
const STRING_PATTERNS = [
  { regex: /\/api\/v\d+\//g, label: 'hardcoded versioned API path' },
  { regex: /api\.framework\.local/g, label: 'hardcoded api.framework.local host' },
  { regex: /__FROMCODE_API_URL/g, label: 'legacy __FROMCODE_API_URL bridge usage' },
  { regex: /FROMCODE_API_URL/g, label: 'direct FROMCODE_API_URL bridge usage' },
  { regex: /NEXT_PUBLIC_API_URL/g, label: 'direct NEXT_PUBLIC_API_URL usage in plugin/theme code' },
  { regex: /SystemConstants\.API_PATH\.AUTH\b/g, label: 'framework auth API path constant usage in plugin/theme code' },
  { regex: /ApiPathUtils\.authPath\s*\(/g, label: 'framework auth path builder usage in plugin/theme code' },
  {
    regex: /['"`]\/auth\/(?:status|setup|login|logout|register|verify-email|resend-verification|forgot-password|reset-password|verify-password|profile|change-password|security|email-change\/request|email-change\/confirm|2fa(?:\/status|\/setup|\/verify|\/recovery-codes\/regenerate)?|sessions(?:\/me|\/revoke-others)?)(?:['"`])/g,
    label: 'direct framework auth API path in plugin/theme code',
  },
];
const PLUGIN_UI_FILE_PATTERN = /\/plugins\/[^/]+\/ui\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
const THEME_SOURCE_FILE_PATTERN = /\/themes\/[^/]+\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
const BROWSER_STATE_PATTERNS = [
  { regex: /\blocalStorage\b/g, label: 'raw localStorage usage outside shared browser-state authorities' },
  { regex: /\bsessionStorage\b/g, label: 'raw sessionStorage usage outside shared browser-state authorities' },
  { regex: /document\.cookie\b/g, label: 'raw document.cookie usage outside shared browser-state authorities' },
  { regex: /Cookies\.(?:get|set|remove)\s*\(/g, label: 'raw js-cookie usage outside shared browser-state authorities' },
  {
    regex: /URLSearchParams\s*\(\s*window\.location\.search\s*\)/g,
    label: 'raw window.location.search query parsing outside shared browser-state authorities',
  },
];

function walk(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];
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
  if (!SOURCE_FILE_PATTERN.test(filePath) && !JSON_FILE_PATTERN.test(filePath)) {
    return false;
  }

  return !IGNORE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
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
  if (JSON_FILE_PATTERN.test(line)) {
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
  const violations = [];
  const isPluginUiFile = PLUGIN_UI_FILE_PATTERN.test(filePath);
  const isThemeSourceFile = THEME_SOURCE_FILE_PATTERN.test(filePath);

  for (const match of lineText.matchAll(IMPORT_PATTERN)) {
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

  for (const candidate of STRING_PATTERNS) {
    for (const match of lineText.matchAll(candidate.regex)) {
      violations.push({
        filePath,
        lineNumber,
        label: candidate.label,
      });
    }
  }

  if (isPluginUiFile || isThemeSourceFile) {
    for (const match of lineText.matchAll(/ApiPathUtils\.pluginPath\s*\(/g)) {
      violations.push({
        filePath,
        lineNumber,
        label: 'plugin UI/theme code should not compose plugin paths with ApiPathUtils.pluginPath()',
      });
    }
  }

  for (const candidate of BROWSER_STATE_PATTERNS) {
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
  if (!JSON_FILE_PATTERN.test(filePath)) {
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
  const violations = [];
  const lineState = createLineState();
  const lines = content.split('\n');
  const ownPackageName = readOwnPackageName(filePath, content);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const strippedLine = JSON_FILE_PATTERN.test(filePath)
      ? rawLine
      : stripCommentsFromLine(rawLine, lineState).text;

    if (strippedLine.trim() === '') {
      return;
    }

    violations.push(...collectLineViolations(filePath, strippedLine, lineNumber, ownPackageName));
  });

  return violations;
}

const allViolations = [];

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
  process.exit(1);
}

console.log('[check-sdk-boundary] OK');
