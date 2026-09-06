/**
 * The MCP surface's WIRE paths — the one place they are written.
 *
 * The api mounts its routes from these constants (`McpRouteUtils` derives from `BASE`) and the
 * remote client appends them to its configured base URL, so the two ends of the wire cannot drift.
 *
 * These are RELATIVE to the api's versioned base. Which version (or none) a deployment serves is
 * deployment configuration, owned by the api (`ApiVersionUtils`); clients receive a FULL base URL
 * (e.g. `https://api.example.com/api/v1`) and never compose or assume a version themselves.
 */
export class McpWirePaths {
  static readonly BASE = '/mcp';
  static readonly TOOLS = '/mcp/tools';
  static readonly TOOLS_CALL = '/mcp/tools/call';
  /** The sites a token may act on. The one MCP route an all-sites token may call before naming a site. */
  static readonly SITES = '/mcp/sites';
  /**
   * Names the site an ALL-SITES token acts on for this request. Ignored for a token bound to one site
   * (a mismatch is refused, never silently redirected). The site is an id or a host of the tenant.
   * A header, not a body field, so the same selection covers tool listing, tool calls and the hosted
   * transport alike — and because the token, not this header, is what grants access.
   */
  static readonly SITE_HEADER = 'x-fc-site';
}
