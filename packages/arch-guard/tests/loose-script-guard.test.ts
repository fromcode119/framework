import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LooseScriptGuard } from '../src/loose-script-guard';
import { FrameworkRoot } from '../src/cli/framework-root';

/**
 * The discriminator is the SHAPE, not the suffix: a script is run, a loader is required. Both sides
 * are asserted, because a guard that only ever passes is worth nothing and one that flags the typed
 * CLI it is pushing work towards is worse than nothing.
 */
describe('LooseScriptGuard', () => {
  const made: string[] = [];
  const write = (root: string, rel: string, body: string) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  };
  const tree = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loose-script-'));
    made.push(root);
    fs.mkdirSync(path.join(root, 'framework', 'Source', 'packages'), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'finance'), { recursive: true });
    const original = FrameworkRoot.repo;
    (FrameworkRoot as any).repo = () => root;
    return { root, restore: () => { (FrameworkRoot as any).repo = original; } };
  };

  afterEach(() => { for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('passes a tree with nothing runnable in it', () => {
    const { root, restore } = tree();
    write(root, 'plugins/finance/index.ts', 'export class X {}');
    try { expect(LooseScriptGuard.run()).toBe(0); } finally { restore(); }
  });

  it('fails on a .sh anywhere in the platform source', () => {
    const { root, restore } = tree();
    write(root, 'framework/Source/setup.sh', '#!/usr/bin/env bash\necho hi\n');
    try { expect(LooseScriptGuard.run()).toBe(1); } finally { restore(); }
  });

  it('fails on an untyped file carrying a shebang', () => {
    const { root, restore } = tree();
    write(root, 'plugins/finance/repair.mjs', '#!/usr/bin/env node\n');
    try { expect(LooseScriptGuard.run()).toBe(1); } finally { restore(); }
  });

  /** Nothing RUNS a loader — a bundler requires it — so it is a module entry, not a script. */
  it('ignores a bundler loader, which has no shebang', () => {
    const { root, restore } = tree();
    write(root, 'framework/Source/packages/x/loader.cjs', "const { P } = require('./dist/b.cjs');\nmodule.exports = P;\n");
    try { expect(LooseScriptGuard.run()).toBe(0); } finally { restore(); }
  });

  /** A typed CLI entry is the shape work is being pushed TOWARDS; flagging it punishes the fix. */
  it('ignores a .ts CLI entry even though it carries a shebang', () => {
    const { root, restore } = tree();
    write(root, 'framework/Source/packages/x/src/cli/thing-cli.ts', '#!/usr/bin/env node\nexport class ThingCli {}\n');
    try { expect(LooseScriptGuard.run()).toBe(0); } finally { restore(); }
  });

  it('ignores build output and installed extension payloads', () => {
    const { root, restore } = tree();
    write(root, 'framework/Source/packages/x/dist/bin.js', '#!/usr/bin/env node\n');
    write(root, 'framework/Source/data/sources/plugins/forms/entry.mjs', '#!/usr/bin/env node\n');
    try { expect(LooseScriptGuard.run()).toBe(0); } finally { restore(); }
  });

  /** Sibling products have their own repositories and their own reasons. */
  it('does not reach outside the platform source', () => {
    const { root, restore } = tree();
    write(root, 'marketplace.fromcode.com/Source/scripts/pack.sh', '#!/usr/bin/env bash\n');
    write(root, 'migration/site-cutover.sh', '#!/usr/bin/env bash\n');
    try { expect(LooseScriptGuard.run()).toBe(0); } finally { restore(); }
  });

  it('allows the declared container entrypoint and nothing else', () => {
    const { root, restore } = tree();
    write(root, 'framework/Source/deploy/docker-entrypoint.sh', '#!/bin/sh\n');
    try { expect(LooseScriptGuard.run()).toBe(0); } finally { restore(); }
    const second = tree();
    write(second.root, 'framework/Source/deploy/docker-entrypoint.sh', '#!/bin/sh\n');
    write(second.root, 'framework/Source/deploy/other-entrypoint.sh', '#!/bin/sh\n');
    try { expect(LooseScriptGuard.run()).toBe(1); } finally { second.restore(); }
  });
});
