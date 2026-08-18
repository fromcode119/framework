// `#sdk/*` are THIS package's subpath imports (package.json `imports`) — the one place the SDK's
// published `.js` specifiers are named. Source never carries an extension.
import { Server } from '#sdk/server';
import { StdioServerTransport } from '#sdk/server-stdio';
import { CallToolRequestSchema, ListToolsRequestSchema } from '#sdk/types';

import { McpHttpClient } from '@mcp-server/mcp-http-client';

/**
 * Speaks MCP over stdio and forwards every request to the platform's HTTP endpoints.
 *
 * The platform's tool NAME (`content.list`) becomes the MCP tool `name` unchanged, so what an
 * operator scopes a token to and what the model calls are the same string — no mapping table to
 * drift.
 */
export class McpStdioServer {
  constructor(private readonly client: McpHttpClient) {}

  async start(): Promise<void> {
    const server = new Server(
      { name: 'fromcode', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: (await this.client.listTools()).map((tool: any) => ({
        name: tool.tool,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const result = await this.client.callTool(
        request.params.name,
        (request.params.arguments || {}) as Record<string, unknown>,
      );
      if (!result.ok) {
        return { isError: true, content: [{ type: 'text', text: String(result.error || 'Tool failed') }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result.output, null, 2) }] };
    });

    await server.connect(new StdioServerTransport());
  }
}
