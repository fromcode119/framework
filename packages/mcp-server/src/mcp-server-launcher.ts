import { McpHttpClient } from '@mcp-server/mcp-http-client';
import { McpStdioServer } from '@mcp-server/mcp-stdio-server';

/**
 * The stdio binary's brain — the compiled `dist/bin.js` entry is a shim that calls `main()` and nothing else,
 * so ALL launcher logic lives here: typed, compiled, and testable.
 *
 * Target and credential come from the ENVIRONMENT so the same binary points at local dev, staging or
 * production without a rebuild — and so the token never appears on a command line, where every other
 * process on the machine could read it.
 */
export class McpServerLauncher {
  static readonly USAGE = 'atlantis-mcp: ATLANTIS_API_URL (full api base, e.g. https://api.example.com/api/v1) and ATLANTIS_API_TOKEN are required. ATLANTIS_SITE (a site id or host) is optional: it preselects the site an all-sites token acts on.';

  /**
   * One variable, under its current name or the `FROMCODE_*` one it used to have.
   *
   * These three are the only variables in the platform set OUTSIDE any machine this project
   * controls: the MCP guide tells people to put them in their own Claude configuration, so a rename
   * with no fallback would break every existing client and report the credential as missing rather
   * than misspelled. `mcp-server` does not depend on core, so it cannot use `EnvUtils` — this is the
   * same two-name rule, written where it can be read.
   */
  private static read(env: Record<string, string | undefined>, name: string): string {
    const current = String(env[`ATLANTIS_${name}`] || '').trim();
    if (current) return current;
    const legacy = String(env[`FROMCODE_${name}`] || '').trim();
    if (legacy) console.error(`atlantis-mcp: FROMCODE_${name} is deprecated — rename it to ATLANTIS_${name}. Both work for now.`);
    return legacy;
  }

  /** Wires a ready server from the environment. Throws the usage message when either value is missing. */
  static create(env: Record<string, string | undefined>): McpStdioServer {
    const baseUrl = McpServerLauncher.read(env, 'API_URL');
    const token = McpServerLauncher.read(env, 'API_TOKEN');
    if (!baseUrl || !token) {
      throw new Error(McpServerLauncher.USAGE);
    }
    // A site-bound token ignores this (the api refuses a mismatch); an all-sites token starts on it
    // instead of needing `sites.select` first.
    const site = McpServerLauncher.read(env, 'SITE') || null;
    return new McpStdioServer(new McpHttpClient(baseUrl, token, fetch, site));
  }

  /** Process entry: a clean one-line error and exit code 1 on any failure, never a raw stack trace. */
  static async main(env: Record<string, string | undefined>): Promise<void> {
    try {
      await McpServerLauncher.create(env).start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message.startsWith('atlantis-mcp:') ? message : `atlantis-mcp: ${message}`);
      process.exit(1);
    }
  }
}
