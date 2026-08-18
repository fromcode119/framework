// `#sdk/*` are THIS package's subpath imports (package.json `imports`) — the one place the SDK's
// published `.js` specifiers are named. Source never carries an extension.
import { Server } from '#sdk/server';
import { StreamableHTTPServerTransport } from '#sdk/server-streamable-http';
import { CallToolRequestSchema, ListToolsRequestSchema } from '#sdk/types';

/**
 * The hosted MCP transport: speaks Streamable HTTP on an express route and forwards list/call onto
 * whatever bridge the host wires in — this package stays free of framework imports, exactly like the
 * stdio server next door. STATELESS on purpose (`sessionIdGenerator: undefined`): the platform's
 * tools are request-scoped and every request is independently authenticated by its API token, so
 * there is no session state worth keeping and nothing for an abandoned session to leak.
 */
export class McpStreamableHandler {
  constructor(private readonly bridge: {
    listTools(req: unknown): Array<{ tool: string; title?: string; description?: string; inputSchema?: Record<string, unknown> }>;
    callTool(name: string, args: Record<string, unknown>, req: unknown): Promise<{ ok: boolean; output?: unknown; error?: string }>;
  }) {}

  /** Handle one POST. GET/DELETE have no meaning in stateless mode — the route answers 405 itself. */
  async handle(req: any, res: any): Promise<void> {
    const server = new Server(
      { name: 'fromcode', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.bridge.listTools(req).map((tool) => ({
        name: tool.tool,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const result = await this.bridge.callTool(
        request.params.name,
        (request.params.arguments || {}) as Record<string, unknown>,
        req,
      );
      if (!result.ok) {
        return { isError: true, content: [{ type: 'text', text: String(result.error || 'Tool failed') }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result.output, null, 2) }] };
    });

    // JSON responses rather than an SSE stream: nothing here emits server-initiated messages, and a
    // plain JSON answer is what curl, the MCP inspector and remote connectors all handle unaided.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
