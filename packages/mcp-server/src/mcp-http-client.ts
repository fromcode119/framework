/**
 * Talks to the platform's generic MCP endpoints.
 *
 * The key goes in `x-api-key`, NOT `Authorization: Bearer` — `AuthManager.middleware()` accepts API
 * keys from that header only, deliberately, because query-string and bearer keys leak into access
 * logs, proxies and Referer headers.
 *
 * The SITE the calls act on is the token's business: a site-bound token needs nothing more; an
 * all-sites token names its site in `McpWirePaths.SITE_HEADER`, chosen with `selectSite` (the stdio
 * server exposes that as a tool, so one configured server reaches every site the token does).
 *
 * `fetch` is injected so the transport is testable without a network. A non-2xx response becomes an
 * error ENVELOPE rather than a throw, because the caller is an MCP server that must answer every
 * request — a thrown transport error would reach the model as a dead connection instead of a
 * readable message.
 */
import { McpWirePaths } from '@fromcode119/mcp';

export class McpHttpClient {
  private readonly baseUrl: string;
  private selectedSite: string | null;

  /** `baseUrl` is the FULL api base including any versioned prefix (e.g. `https://api.x/api/v1`). */
  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    site: string | null = null,
  ) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.selectedSite = String(site || '').trim() || null;
  }

  get site(): string | null {
    return this.selectedSite;
  }

  selectSite(site: string | null): void {
    this.selectedSite = String(site || '').trim() || null;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': this.token };
    if (this.selectedSite) headers[McpWirePaths.SITE_HEADER] = this.selectedSite;
    return headers;
  }

  async listTools(): Promise<any[]> {
    const response = await this.fetchImpl(`${this.baseUrl}${McpWirePaths.TOOLS}`, { headers: this.headers() });
    const body: any = await response.json();
    if (!response.ok) return [];
    return Array.isArray(body?.tools) ? body.tools : [];
  }

  /** The sites this token may act on. `multiTenant: false` on a single-site platform (no site to pick). */
  async listSites(): Promise<{ ok: boolean; multiTenant: boolean; allSites: boolean; current: string | null; sites: Array<{ id: string; slug: string; host: string }>; error?: string }> {
    const response = await this.fetchImpl(`${this.baseUrl}${McpWirePaths.SITES}`, { headers: this.headers() });
    const body: any = await response.json();
    if (!response.ok) return { ok: false, multiTenant: false, allSites: false, current: null, sites: [], error: `HTTP ${response.status}: ${body?.error || 'request failed'}` };
    return { ok: true, multiTenant: body?.multiTenant === true, allSites: body?.allSites === true, current: body?.current ?? null, sites: Array.isArray(body?.sites) ? body.sites : [] };
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
