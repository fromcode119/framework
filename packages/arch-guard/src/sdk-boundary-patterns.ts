/**
 * What the SDK boundary actually forbids, as patterns.
 *
 * The rule is one sentence — a plugin or theme imports from `@fromcode119/sdk` and from nothing else
 * inside the framework — and everything here is an exception or a refinement of it, each earned by a
 * real escape:
 *
 *   - some patterns are violations ONLY in frontend code, because a plugin's own backend may
 *     legitimately reference its own versioned API path;
 *   - browser-state patterns catch a plugin reaching for `window`/`localStorage` directly instead of
 *     the SDK's accessors, which is how a plugin ends up unable to render on the server;
 *   - the ignore list exists because build output and node_modules contain the very strings this
 *     forbids, and scanning them would report the framework to itself.
 *
 * Split out of `SdkBoundaryGuard` (335 lines), which walks the trees and reports. Separating the
 * patterns from the walk means a new exception is a visible change to the RULE rather than a line
 * buried in a 300-line method.
 */
export class SdkBoundaryPatterns {
  static readonly SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
  static readonly JSON_FILE_PATTERN = /\/package\.json$/;
  static readonly IGNORE_PATH_PATTERNS = [
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
    // themes/<slug>/ui-ssr/** holds the compiled SSR + island bundle output (entry.mjs/live.js);
    // the source lives in src/islands/. Same rationale as ui/ above — build artifacts, not source.
    /\/themes\/[^/]+\/ui-ssr\//,
    /\/frontend\.js$/,
  ];

  static readonly IMPORT_PATTERN = /@fromcode119\/(?!sdk(?:\/|['"\s]|$))[A-Za-z0-9._/-]+/g;
  static readonly STRING_PATTERNS: Array<{ regex: RegExp; label: string; skipInAbsoluteUrl?: boolean }> = [
    // `skipInAbsoluteUrl`: a versioned segment inside an absolute third-party URL is that service's
    // own address (Expo's https://exp.host/--/api/v2/push/send), not a path composed against OUR
    // API — the rule targets relative-path composition that must go through the plugin's route
    // resolver / ApplicationUrlUtils. Hardcoding one of OUR hosts is caught by the host rules below.
    { regex: /\/api\/v\d+\//g, label: 'hardcoded versioned API path', skipInAbsoluteUrl: true },
    { regex: /api\.framework\.local/g, label: 'hardcoded api.framework.local host' },
    { regex: /__ATLANTIS_API_URL/g, label: 'legacy __ATLANTIS_API_URL bridge usage' },
    { regex: /ATLANTIS_API_URL/g, label: 'direct ATLANTIS_API_URL bridge usage' },
    // READING the variable is the violation — the URL comes from `ApplicationUrlUtils`, which is the
    // whole point of the rule. A test ASSIGNING it is arranging the world the code under test runs
    // in, the way a fixture sets any other environment value; there is no other way to simulate a
    // deployment's base URL, so reporting it asks for a test to be deleted rather than fixed.
    { regex: /NEXT_PUBLIC_API_URL(?!\s*=[^=])/g, label: 'direct NEXT_PUBLIC_API_URL usage in plugin/theme code' },
    { regex: /SystemConstants\.API_PATH\.AUTH\b/g, label: 'framework auth API path constant usage in plugin/theme code' },
    { regex: /ApiPathUtils\.authPath\s*\(/g, label: 'framework auth path builder usage in plugin/theme code' },
    {
      regex: /['"`]\/auth\/(?:status|setup|login|logout|register|verify-email|resend-verification|forgot-password|reset-password|verify-password|profile|change-password|security|email-change\/request|email-change\/confirm|2fa(?:\/status|\/setup|\/verify|\/recovery-codes\/regenerate)?|sessions(?:\/me|\/revoke-others)?)(?:['"`])/g,
      label: 'direct framework auth API path in plugin/theme code',
    },
  ];
  // Patterns that are violations ONLY in frontend (plugin UI + theme) code — a plugin's own backend may
  // legitimately reference its own versioned path. Same `{ regex, label }` shape as STRING_PATTERNS.
  static readonly FRONTEND_STRING_PATTERNS = [
    {
      regex: /ApiPathUtils\.pluginPath\s*\(/g,
      label: 'plugin UI/theme code should not compose plugin paths with ApiPathUtils.pluginPath()',
    },
    {
      // A literal versioned plugin API path in FRONTEND code (with OR without a leading slash — the no-slash
      // form slips past the global `/api/v\d+/` rule when built via joinApiPath(base, 'api/v1/...')). Frontend
      // must call a plugin through its namespace client (`runtime.fromcode.<slug>` / a passed scope client),
      // which owns the base + version + auth.
      regex: /\bapi\/v\d+\/plugins\/[a-z0-9-]+/gi,
      label: 'hardcoded plugin API path in frontend code — call the plugin via its namespace client, not a literal api/v1/plugins/<slug> string',
    },
    {
      // Secret credentials (Stripe/API secret keys) are resolved SERVER-SIDE only. A browser/theme bundle
      // must never call a `get…SecretKey()` accessor — that would pull a server secret into the client.
      // Domain-agnostic by design: matches the accessor SHAPE, so it catches ANY plugin's secret-key getter
      // without this framework scanner naming a specific plugin or provider.
      regex: /\bget\w*SecretKey\s*\(/gi,
      label: 'secret-key accessor called in frontend code — secret credentials are server-side only and must never be resolved in a browser/theme bundle',
    },
  ];
  static readonly PLUGIN_UI_FILE_PATTERN = /\/plugins\/[^/]+\/ui\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
  static readonly THEME_SOURCE_FILE_PATTERN = /\/themes\/[^/]+\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/;
  static readonly BROWSER_STATE_PATTERNS = [
    { regex: /\blocalStorage\b/g, label: 'raw localStorage usage outside shared browser-state authorities' },
    { regex: /\bsessionStorage\b/g, label: 'raw sessionStorage usage outside shared browser-state authorities' },
    { regex: /document\.cookie\b/g, label: 'raw document.cookie usage outside shared browser-state authorities' },
    { regex: /Cookies\.(?:get|set|remove)\s*\(/g, label: 'raw js-cookie usage outside shared browser-state authorities' },
    {
      regex: /URLSearchParams\s*\(\s*window\.location\.search\s*\)/g,
      label: 'raw window.location.search query parsing outside shared browser-state authorities',
    },
  ];
}
