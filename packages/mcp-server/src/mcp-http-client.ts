/**
 * Talks to the platform's generic MCP endpoints.
 *
 * The key goes in `x-api-key`, NOT `Authorization: Bearer` — `AuthManager.middleware()` accepts API
 * keys from that header only, deliberately, because query-string and bearer keys leak into access
 * logs, proxies and Referer headers.
 *
 * `fetch` is injected so the transport is testable without a network. A non-2xx response becomes an
 * error ENVELOPE rather than a throw, because the caller is an MCP server that must answer every
 * request — a thrown transport error would reach the model as a dead connection instead of a
 * readable message.
 */
import { McpWirePaths } from '@fromcode119/mcp';

export class McpHttpClient {
  private readonly baseUrl: string;

  /** `baseUrl` is the FULL api base including any versioned prefix (e.g. `https://api.x/api/v1`). */
  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
  }

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'x-api-key': this.token };
  }

  async listTools(): Promise<any[]> {
    const response = await this.fetchImpl(`${this.baseUrl}${McpWirePaths.TOOLS}`, { headers: this.headers() });
    const body: any = await response.json();
    if (!response.ok) return [];
    return Array.isArray(body?.tools) ? body.tools : [];
  }

  async callTool(tool: string, input: Record<string, unknown>): Promise<{ ok: boolean; output?: unknown; error?: string }> {
    const response = await this.fetchImpl(`${this.baseUrl}${McpWirePaths.TOOLS_CALL}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ tool, input }),
    });
    const body: any = await response.json();
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}: ${body?.error || 'request failed'}` };
    return body;
  }
}
