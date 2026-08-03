/* eslint-disable */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Plugin UI components must be hook-free OOP classes.
 *
 * An OOP-shape rule, so it belongs to typor: a plugin's UI is a `PluginComponent` class with `@prop` /
 * `@state`, never a function component calling hooks. The one sanctioned hook site is reactor's `Bridge`.
 *
 * Ported verbatim from the previous script — same patterns, same counts.
 */
export class PluginUiHookGuard {
  // Guard: plugin UI components must be hook-free OOP classes.
  // Fails when any plugins/<slug>/src/ui/**/*.tsx file contains a React hook call
  // or an `export const/function <Capitalized>` (function component).
  //
  // Run from framework/Source:  node packages/archor/dist/archor-cli.cjs plugin-ui-hookfree
  // Resolves the repo-root plugins dir the same way check-sdk-boundary.mjs does.

  static readonly PLUGINS_DIR = path.resolve(process.cwd(), '../../plugins');

  // Dev/test fixtures excluded until Task 20 decides their fate.
  static readonly IGNORE = new Set<string>(['build-server', 'test-feature']);

  // No files currently require a hook-boundary exemption.
  // order-popup-connected.tsx was converted to a hook-free PluginComponent class (Task 3 complete).
  static readonly IGNORE_FILES = new Set<string>();

  // Pre-existing offenders found when the checker's blind spots were closed
  // (.ts scanning + custom-hook detection). BURNED DOWN TO ZERO — do not add to it.
  // What happened to each original entry:
  //   - block-editor-settings-panel.tsx  → false positive (a code comment mentioned a
  //     `useXxx()` call); comment reworded, file was already a hook-free class.
  //   - cms-document-context.ts          → dead `use()` (useContext) accessor removed;
  //     the file keeps only the React context object (consumed via .Consumer/.Provider).
  //   - visual-editor-runtime-context.ts → dead `VisualEditorRuntime.use()` class had no
  //     callers (consumers use VisualEditorRuntimeReactContext.value.Consumer); file deleted.
  //   - cms/src/ui/hooks.ts (MenuHooks)  → dead, no callers; file deleted.
  //   - numerology/src/ui/use-async-data.ts (AsyncDataLoader) → dead, no callers; file deleted.
  //   - checkout-flow-controller.ts      → dead `static useState` React-hook adapter removed;
  //     the sole consumer (theme) already uses the hook-free `createCheckoutFlowController`.
  //   - ecommerce-plugin-client.storefront.ts → dead `checkoutFlowController()` wrapper (which
  //     called `CheckoutFlowController.useState`) removed for the same reason.
  static readonly KNOWN_OFFENDERS = new Set<string>([]);

  // Intentional React-hook APIs that legitimately live in plugin UI. These are NOT
  // hook-free-class candidates: each is a hook that a React FUNCTION component consumes
  // as a hook (subscribes to React state and re-renders). Reported as an allowlisted
  // warning, not a violation.
  //   - use-datasource-selector.ts: `DatasourceSelectorHooks.useDatasourceSelector(value,
  //     onChange)` is consumed by the `DatasourceSelectorView` function component
  //     (block-editor/datasource-selector.tsx), which itself uses ContextHooks.useTranslation().
  //     It is genuinely a hook, not a component or convertible headless controller.
  static readonly INTENTIONAL_HOOK_APIS = new Set<string>([
    'cms/src/ui/hooks/use-datasource-selector.ts',
  ]);

  static readonly HOOK = /\buse(State|Effect|Memo|Ref|Callback|Context)\b/;
  // Custom hook invocation: bare `useXxx(` not preceded by `.` (method calls on a
  // namespace/class are not React hooks) or a word character.
  static readonly CUSTOM_HOOK = /(?<![.\w])use[A-Z]\w*\s*\(/;
  static readonly FC = /export\s+(const|function)\s+[A-Z][A-Za-z0-9]*/;

  static walkTsx(dir: string, out: string[]): void {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        // Never scan installed deps or build output — a plugin's own UI runtime deps (react-day-picker,
        // @tanstack, …) live in src/ui/node_modules and are NOT authored plugin code.
        if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
        PluginUiHookGuard.walkTsx(full, out);
      } else if (full.endsWith('.tsx') || (full.endsWith('.ts') && !full.endsWith('.d.ts'))) out.push(full);
    }
  }

  /** Scan every plugin UI file; returns violations, allowlisted warnings and the file count. */
  static scan(): { violations: string[]; warnings: string[]; scanned: number } {
  const violations: string[] = [];
  const knownOffenderWarnings: string[] = [];
  let scanned = 0;
  
  let slugs: string[] = [];
  try {
    slugs = readdirSync(PluginUiHookGuard.PLUGINS_DIR);
  } catch {
    console.error(`Cannot read plugins dir: ${PluginUiHookGuard.PLUGINS_DIR}`);
    process.exit(2);
  }
  
  for (const slug of slugs) {
    if (PluginUiHookGuard.IGNORE.has(slug)) continue;
    const uiDir = path.join(PluginUiHookGuard.PLUGINS_DIR, slug, 'src', 'ui');
    const files: string[] = [];
    PluginUiHookGuard.walkTsx(uiDir, files);
    for (const file of files) {
      const rel = path.relative(PluginUiHookGuard.PLUGINS_DIR, file);
      if (PluginUiHookGuard.IGNORE_FILES.has(rel)) continue;
      scanned += 1;
      const src = readFileSync(file, 'utf8');
      const fileViolations: string[] = [];
      if (PluginUiHookGuard.HOOK.test(src)) fileViolations.push(`plugins/${rel}: contains a React hook call`);
      else if (PluginUiHookGuard.CUSTOM_HOOK.test(src)) fileViolations.push(`plugins/${rel}: contains a custom hook invocation (use<X>())`);
      if (PluginUiHookGuard.FC.test(src) && file.endsWith('.tsx')) fileViolations.push(`plugins/${rel}: contains 'export const/function <Capitalized>' (function component)`);
      if (!fileViolations.length) continue;
      if (PluginUiHookGuard.INTENTIONAL_HOOK_APIS.has(rel)) {
        knownOffenderWarnings.push(...fileViolations.map((v) => `${v} [intentional hook API — allowed]`));
      } else if (PluginUiHookGuard.KNOWN_OFFENDERS.has(rel)) {
        knownOffenderWarnings.push(...fileViolations.map((v) => `${v} [known offender — burn down]`));
      } else {
        violations.push(...fileViolations);
      }
    }
  }
  
    return { violations, warnings: knownOffenderWarnings, scanned };
  }
}
