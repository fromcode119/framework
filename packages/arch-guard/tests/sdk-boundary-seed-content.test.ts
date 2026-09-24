import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SdkBoundaryGuard } from '../src/sdk-boundary-guard';
import { GuardScope } from '../src/cli/guard-scope';

/**
 * A seed's string literals are the CONTENT it creates — an article may explain the MCP server's
 * `ATLANTIS_API_URL` setting without the theme reading that variable. The string patterns are waived
 * for `seeds/`; a forbidden framework IMPORT in a seed file is still a violation.
 */
describe('SdkBoundaryGuard and seed content', () => {
  let root = '';

  const theme = (files: Record<string, string>): void => {
    root = mkdtempSync(path.join(tmpdir(), 'sdk-boundary-'));
    const dir = path.join(root, 'themes', 'demo');
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), body);
    }
    vi.stubEnv(GuardScope.ENV, dir);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('does not report an article that names ATLANTIS_API_URL in its text', () => {
    theme({ 'src/seeds/posts/mcp.ts': "export class Post { static body = 'set \"ATLANTIS_API_URL\": \"https://api.example.com/api/v1\"'; }\n" });
    expect(SdkBoundaryGuard.run()).toBe(0);
  });

  it('still reports the same string in theme source outside seeds', () => {
    theme({ 'src/lib/api.ts': "export class Api { static base = (globalThis as any).ATLANTIS_API_URL; }\n" });
    expect(SdkBoundaryGuard.run()).toBe(1);
  });

  it('still reports a forbidden framework import inside a seed file', () => {
    theme({ 'src/seeds/pages.ts': "import { Something } from '@fromcode119/core';\nexport class Pages { static x = Something; }\n" });
    expect(SdkBoundaryGuard.run()).toBe(1);
  });
});
