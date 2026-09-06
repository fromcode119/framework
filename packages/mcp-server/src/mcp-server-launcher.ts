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
  static readonly USAGE = 'fromcode-mcp: FROMCODE_API_URL (full api base, e.g. https://api.example.com/api/v1) and FROMCODE_API_TOKEN are required. FROMCODE_SITE (a site id or host) is optional: it preselects the site an all-sites token acts on.';

  /** Wires a ready server from the environment. Throws the usage message when either value is missing. */
  static create(env: Record<string, string | undefined>): McpStdioServer {
    const baseUrl = String(env.FROMCODE_API_URL || '').trim();
    const token = String(env.FROMCODE_API_TOKEN || '').trim();
    if (!baseUrl || !token) {
      throw new Error(McpServerLauncher.USAGE);
    }
    // A site-bound token ignores this (the api refuses a mismatch); an all-sites token starts on it
    // instead of needing `sites.select` first.
    const site = String(env.FROMCODE_SITE || '').trim() || null;
    return new McpStdioServer(new McpHttpClient(baseUrl, token, fetch, site));
  }

  /** Process entry: a clean one-line error and exit code 1 on any failure, never a raw stack trace. */
  static async main(env: Record<string, string | undefined>): Promise<void> {
    try {
      await McpServerLauncher.create(env).start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message.startsWith('fromcode-mcp:') ? message : `fromcode-mcp: ${message}`);
      process.exit(1);
    }
  }
}
