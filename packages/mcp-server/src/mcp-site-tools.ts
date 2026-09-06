import { McpHttpClient } from '@mcp-server/mcp-http-client';

/**
 * The two tools the stdio server adds LOCALLY so one configured server reaches every site its token
 * does: list the sites, select one. They never hit the platform's tool registry — they change which
 * site the client names on every following request. Named under `sites.*`, a namespace no plugin can
 * own (a plugin's tools are prefixed with its own slug).
 *
 * A site-bound token gets exactly one site back and `select` of anything else is refused by the api;
 * these tools then merely confirm the binding.
 */
export class McpSiteTools {
  static readonly LIST = 'sites.list';
  static readonly SELECT = 'sites.select';

  constructor(private readonly client: McpHttpClient) {}

  definitions(): Array<{ name: string; title: string; description: string; inputSchema: Record<string, unknown> }> {
    return [
      {
        name: McpSiteTools.LIST,
        title: 'List sites',
        description: 'The sites this token may act on, and which one is selected. Call this first on a multi-site platform.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: McpSiteTools.SELECT,
        title: 'Select site',
        description: 'Choose the site every following tool call acts on (by id, slug or host). The tool list is reloaded for that site.',
        inputSchema: { type: 'object', properties: { site: { type: 'string', description: 'Site id, slug or host from sites.list' } }, required: ['site'], additionalProperties: false },
      },
    ];
  }

  handles(name: string): boolean {
    return name === McpSiteTools.LIST || name === McpSiteTools.SELECT;
  }

  /** Returns the tool result envelope, and whether the selection CHANGED (the caller re-announces its tools then). */
  async call(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; output?: unknown; error?: string; changed: boolean }> {
    if (name === McpSiteTools.LIST) {
      const sites = await this.client.listSites();
      if (!sites.ok) return { ok: false, error: sites.error, changed: false };
      return { ok: true, output: { multiTenant: sites.multiTenant, allSites: sites.allSites, selected: this.client.site ?? sites.current, sites: sites.sites }, changed: false };
    }
    const requested = String(args?.site ?? '').trim();
    if (!requested) return { ok: false, error: 'sites.select needs a "site" (id, slug or host from sites.list).', changed: false };
    const sites = await this.client.listSites();
    if (!sites.ok) return { ok: false, error: sites.error, changed: false };
    const match = sites.sites.find((site) => [site.id, site.slug, site.host].some((value) => String(value).toLowerCase() === requested.toLowerCase()));
    if (!match) return { ok: false, error: `No site "${requested}" is reachable with this token. Known: ${sites.sites.map((s) => s.id).join(', ') || 'none'}.`, changed: false };
    const changed = this.client.site !== match.id;
    this.client.selectSite(match.id);
    return { ok: true, output: { selected: match.id, host: match.host }, changed };
  }
}
