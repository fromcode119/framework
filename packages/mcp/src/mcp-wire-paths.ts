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
}
