import type { IMcpToolDefinition } from '@mcp/interfaces/mcp-tool-definition.interface';
import type { IMcpToolSummary } from '@mcp/interfaces/mcp-tool-summary.interface';

/**
 * Process-wide registry of MCP tools.
 *
 * Namespacing is the SECURITY BOUNDARY, not a convention: an owner may register only its own prefix,
 * so one plugin cannot shadow or impersonate another's tool. It also means a plugin never writes
 * another plugin's slug as a literal, which the architecture rules forbid anyway.
 *
 * Collisions THROW rather than last-write-wins — a silent overwrite would let load order decide which
 * handler runs.
 */
export class McpToolRegistry {
  static readonly FRAMEWORK_OWNER = 'framework';

  /** Bare namespaces the framework owns. No plugin may claim one. */
  private static readonly RESERVED = [
    'content', 'collections', 'media', 'themes', 'plugins',
    'settings', 'system', 'backups', 'cache', 'deploy', 'web', 'redirects',
  ];

  private readonly tools = new Map<string, IMcpToolDefinition>();
  private readonly toolOwners = new Map<string, string>();
  private readonly sources = new Map<string, (context?: Record<string, unknown>) => IMcpToolDefinition[]>();
  private skipped: string[] = [];

  /**
   * Register a LAZY source of tools.
   *
   * Some tools cannot exist at boot: the Admin Assistant's 39 close over per-request state, so they
   * are built from the live request rather than declared once. A source is evaluated on every
   * `listTools`/`resolve`, receives the caller's context, and its output goes through exactly the same
   * namespace and collision rules as a static tool — a source must not become a way around the
   * boundary.
   */
  registerSource(ownerSlug: string, build: (context?: Record<string, unknown>) => IMcpToolDefinition[]): void {
    const owner = String(ownerSlug || '').trim();
    if (!owner) throw new Error('MCP tool source registration requires an owner slug.');
    if (this.sources.has(owner)) throw new Error(`MCP tool source for "${owner}" is already registered.`);
    this.sources.set(owner, build);
  }

  /** Static tools plus everything the registered sources yield for this context, namespace-checked. */
  private collect(context?: Record<string, unknown>): IMcpToolDefinition[] {
    const all = [...this.tools.values()];
    const names = new Set(all.map((tool) => tool.tool));
    for (const [owner, build] of this.sources) {
      let produced: IMcpToolDefinition[] = [];
      try {
        produced = build(context) || [];
      } catch {
        // A source that throws yields nothing rather than taking down the whole tool list.
        produced = [];
      }
      for (const tool of produced) {
        const name = String(tool?.tool || '').trim();
        if (!name || names.has(name)) continue;
        this.assertNamespace(owner, name);
        names.add(name);
        all.push(tool);
      }
    }
    return all;
  }

  register(ownerSlug: string, tools: IMcpToolDefinition[]): void {
    const owner = String(ownerSlug || '').trim();
    if (!owner) throw new Error('MCP tool registration requires an owner slug.');

    for (const tool of tools) {
      const name = String(tool?.tool || '').trim();
      if (!name) throw new Error(`Owner "${owner}" registered a tool with no name.`);
      this.assertNamespace(owner, name);
      if (this.tools.has(name)) {
        throw new Error(`MCP tool "${name}" is already registered; owner "${owner}" cannot re-register it.`);
      }
      this.tools.set(name, tool);
      this.toolOwners.set(name, owner);
      if (!tool.inputSchema || !tool.permission) this.skipped.push(name);
    }
  }

  /**
   * Drop everything one owner registered — its static tools AND its lazy source.
   *
   * This exists for the plugin lifecycle: a plugin's `onInit` re-runs in-process on every
   * disable/enable cycle, and without this a re-registering plugin would collide with its own
   * previous boot and fail to enable. The plugin context calls it before the first registration of
   * a new lifetime; it never touches another owner's tools.
   */
  unregisterOwner(ownerSlug: string): void {
    const owner = String(ownerSlug || '').trim();
    if (!owner) return;
    const removed: string[] = [];
    for (const [name, toolOwner] of this.toolOwners) {
      if (toolOwner !== owner) continue;
      this.tools.delete(name);
      removed.push(name);
    }
    for (const name of removed) this.toolOwners.delete(name);
    if (removed.length) this.skipped = this.skipped.filter((name) => !removed.includes(name));
    this.sources.delete(owner);
  }

  listTools(context?: Record<string, unknown>): IMcpToolSummary[] {
    const summaries: IMcpToolSummary[] = [];
    for (const tool of this.collect(context)) {
      if (!tool.inputSchema || !tool.permission) continue;
      summaries.push({
        tool: tool.tool,
        title: tool.title,
        description: tool.description,
        readOnly: tool.readOnly === true,
        permission: tool.permission,
        inputSchema: tool.inputSchema,
      });
    }
    return summaries;
  }

  /** Names excluded from `listTools()` for a missing schema or permission — logged at boot, never hidden. */
  listSkipped(): string[] {
    return [...this.skipped];
  }

  resolve(tool: string, context?: Record<string, unknown>): IMcpToolDefinition | null {
    const name = String(tool || '').trim();
    const stat = this.tools.get(name);
    if (stat) return stat;
    return this.collect(context).find((candidate) => candidate.tool === name) || null;
  }

  private assertNamespace(owner: string, name: string): void {
    const head = name.split('.')[0];
    if (owner === McpToolRegistry.FRAMEWORK_OWNER) return;
    if (McpToolRegistry.RESERVED.includes(head)) {
      throw new Error(`MCP namespace "${head}" is reserved for the framework; owner "${owner}" cannot register "${name}".`);
    }
    if (head !== owner) {
      throw new Error(`Owner "${owner}" may register only "${owner}.*" tools, not "${name}".`);
    }
  }
}
