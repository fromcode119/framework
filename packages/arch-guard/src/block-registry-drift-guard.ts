/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { FrameworkRoot } from './cli/framework-root';

/**
 * Parity between the shared block identity registry and the two editors that define blocks.
 *
 * A block type an editor defines but the registry does not know, or a registry entry flagged for an
 * editor that does not define it, is drift: one side ships a block the other cannot place.
 *
 * Ported here from a loose `plugins/cms/scripts/*.mjs`. As a script in an extension it was hashed
 * with the extension, ran nowhere the extension is installed, and — the point — was wired into
 * nothing, so it had never once run in CI. A static check is a guard, and guards live here.
 */
export class BlockRegistryDriftGuard {
  private static readonly VE_SCHEMA_FILES = [
    'block-schemas-layout.ts', 'block-schemas-content.ts', 'block-schemas-media.ts', 'block-schemas-commerce.ts',
  ];

  static run(): number {
    const uiRoot = path.resolve(FrameworkRoot.repo(), 'plugins', 'cms', 'src', 'ui', 'components');
    if (!fs.existsSync(uiRoot)) {
      console.log(`No cms plugin at ${uiRoot}; nothing to scan.`);
      return 0;
    }
    const read = (rel: string) => fs.readFileSync(path.join(uiRoot, rel), 'utf8');

    const registry = new Map<string, { adminEditor: boolean; visualEditor: boolean }>();
    const entryRe = /type:\s*'([^']+)'[\s\S]*?adminEditor:\s*(true|false)[\s\S]*?visualEditor:\s*(true|false)/g;
    for (const match of read('block-registry/block-registry-entries.ts').matchAll(entryRe)) {
      registry.set(match[1]!, { adminEditor: match[2] === 'true', visualEditor: match[3] === 'true' });
    }

    const adminIds = BlockRegistryDriftGuard.adminBlockIds(read);
    const veIds = BlockRegistryDriftGuard.visualEditorBlockIds(read);

    const problems: string[] = [];
    for (const id of adminIds) {
      const entry = registry.get(id);
      if (!entry) problems.push(`admin block '${id}' missing from shared registry`);
      else if (!entry.adminEditor) problems.push(`registry entry '${id}' not flagged adminEditor but admin defines it`);
    }
    for (const id of veIds) {
      const entry = registry.get(id);
      if (!entry) problems.push(`visual-editor schema '${id}' missing from shared registry`);
      else if (!entry.visualEditor) problems.push(`registry entry '${id}' not flagged visualEditor but VE defines it`);
    }
    for (const [id, entry] of registry) {
      if (entry.adminEditor && !adminIds.has(id)) problems.push(`registry says '${id}' has an admin editor but none found`);
      if (entry.visualEditor && !veIds.has(id)) problems.push(`registry says '${id}' has a VE schema but none found`);
    }

    if (problems.length) {
      console.error(`[check-block-registry-drift] Block registry drift detected (${problems.length}):`);
      for (const problem of problems) console.error(`  - ${problem}`);
      return 1;
    }
    console.log(`Block registry parity OK — ${registry.size} registered, ${adminIds.size} admin editors, ${veIds.size} VE schemas.`);
    return 0;
  }

  /**
   * Admin editor block ids, reached through the barrel.
   *
   * The specifiers are NOT relative — the repo moved every in-plugin import to the `@plugin/src/...`
   * alias. Matching `from './x'` therefore matched nothing, adminIds stayed EMPTY, and the check
   * reported all 24 admin entries as "has an admin editor but none found": 24 false positives burying
   * the one real finding. Take the BASENAME of whatever specifier is written, so it survives the next
   * path-shape change too.
   */
  private static adminBlockIds(read: (rel: string) => string): Set<string> {
    const ids = new Set<string>();
    for (const match of read('block-editor/blocks/index.ts').matchAll(/from '([^']+)'/g)) {
      const basename = match[1]!.split('/').pop();
      if (!basename) continue;
      // A block may split across sibling files (team-block.ts holds the definition, team-block.tsx
      // the view) — scan BOTH extensions and take any definition id found.
      for (const ext of ['tsx', 'ts']) {
        let source = '';
        try { source = read(`block-editor/blocks/${basename}.${ext}`); } catch { continue; }
        const id = source.match(/definition[\s\S]{0,200}?id:\s*'([^']+)'/);
        if (id) ids.add(id[1]!);
      }
    }
    return ids;
  }

  /**
   * BLOCK types only — the `type:` immediately following a `VisualEditorBlockSchema = {` declaration.
   * A plain `type:` match would also catch field-level input types like 'text' / 'select'.
   */
  private static visualEditorBlockIds(read: (rel: string) => string): Set<string> {
    const ids = new Set<string>();
    for (const file of BlockRegistryDriftGuard.VE_SCHEMA_FILES) {
      let source = '';
      try { source = read(`visual-editor/${file}`); } catch { continue; }
      for (const match of source.matchAll(/VisualEditorBlockSchema\s*=\s*\{\s*type:\s*'([^']+)'/g)) ids.add(match[1]!);
    }
    return ids;
  }
}
