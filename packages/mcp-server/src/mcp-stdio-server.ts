// `#sdk/*` are THIS package's subpath imports (package.json `imports`) — the one place the SDK's
// published `.js` specifiers are named. Source never carries an extension.
import { McpServer } from '#sdk/server-mcp';
import { StdioServerTransport } from '#sdk/server-stdio';
import { CallToolRequestSchema, ListToolsRequestSchema } from '#sdk/types';

import { McpHttpClient } from '@mcp-server/mcp-http-client';
import { McpSiteTools } from '@mcp-server/mcp-site-tools';

/**
 * Speaks MCP over stdio and forwards every request to the platform's HTTP endpoints.
 *
 * The platform's tool NAME (`content.list`) becomes the MCP tool `name` unchanged, so what an
 * operator scopes a token to and what the model calls are the same string — no mapping table to
 * drift. Two tools are local (see McpSiteTools): they pick which SITE the platform tools act on, and
 * a selection change re-announces the tool list, since the site decides which plugins' tools exist.
 *
 * The tool list is the PLATFORM's, fetched per request with its own JSON input schemas, so the
 * list/call handlers are set on the low-level protocol server the SDK exposes for exactly this case
 * (`McpServer.server`), not registered one by one through `registerTool`.
 */
export class McpStdioServer {
  private readonly sites: McpSiteTools;
  private server: McpServer | null = null;

  constructor(private readonly client: McpHttpClient) {
    this.sites = new McpSiteTools(client);
  }

  async start(): Promise<void> {
    const server = new McpServer(
      { name: 'fromcode', version: '0.1.0' },
      { capabilities: { tools: { listChanged: true } } },
    );
    this.server = server;

    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ...this.sites.definitions(),
        ...(await this.client.listTools()).map((tool: any) => ({
          name: tool.tool,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      ],
    }));

    server.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const name = String(request.params.name);
      const args = (request.params.arguments || {}) as Record<string, unknown>;
      const result = this.sites.handles(name) ? await this.siteCall(name, args) : await this.client.callTool(name, args);
      if (!result.ok) {
        return { isError: true, content: [{ type: 'text', text: String(result.error || 'Tool failed') }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result.output, null, 2) }] };
    });

    await server.connect(new StdioServerTransport());
  }

  private async siteCall(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; output?: unknown; error?: string }> {
    const result = await this.sites.call(name, args);
    if (result.changed && this.server) this.server.sendToolListChanged();
    return result;
  }
}
