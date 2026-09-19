# MCP Server — AI Agent Access

Every Atlantis installation doubles as a **Model Context Protocol server**. An AI agent with a scoped
token can do real operator work — read and update content, swap a page's images by *named slot*,
inspect orders, shipments and invoices, upload media, purge caches — without ssh, database access, or
a human relaying clicks.

## Security model

- **Token-only access.** Tool calls authenticate with an `x-api-key` access token minted in
  **Settings → Integrations → MCP**. The raw key is shown exactly once; only its SHA-256 hash is
  stored. Session cookies are rejected on tool routes, and tokens cannot mint other tokens.
- **Two independent gates.** A token's **scopes** (`content.*`, `ecommerce.*`, …) limit which tools
  it may *reach*; each tool's own **permission** (`content:read`, `system:view`, `system:manage`, …)
  is then checked against the calling user's roles. Scopes only ever narrow — they never grant.
- **PII is tiered.** List projections carry no customer emails, addresses, banking or tax
  identifiers; single-record reads behind `system:view` include only what a permitted operator needs.
  Invoice tools are **read-only permanently** (the legal series is never mutated over MCP), and
  `deploy.restart` carries its own dedicated permission so no routine token can restart a server.
- **Everything is audited.** Every call lands in `_system_audit_logs` (tool name, user, argument
  *keys* — never values) plus a log line for live tailing.
- **Remote transport is off by default.** The hosted endpoint answers `403` until an operator flips
  **Settings → Integrations → MCP → Remote access**, and it is rate-limited per address.

## Sites

On a multi-site platform every token names the site it acts on. A site admin can only mint tokens for
their own site; the platform admin may mint an **all-sites** token and pick the site per call with the
`x-fc-site` header. The stdio server exposes two local tools, `sites.list` and `sites.select`, and
`ATLANTIS_SITE` preselects one at launch; selecting a site re-announces the tool list, because the site
decides which plugins' tools exist. A workspace's console can also reach the hosted endpoint on its own
domain (`https://<workspace-domain>/api/v1/mcp`).

## Tool surface

| Namespace | Tools | Notes |
|---|---|---|
| `system.*`, `media.*`, `cache.*`, `deploy.*` | server time, media list/upload/replace, framework cache purge, process restart | `media.replace` always writes a **new filename** so CDNs cannot serve stale bytes; `cache.purge` reports the CDN half honestly (`cdn: false` when no credentials exist) |
| `content.*`, `collections.*`, `settings.*`, `plugins.*`, `themes.*`, `web.*`, `backups.*` | the Admin Assistant's full toolset, exposed per request | built lazily from the live request, so they always match what the in-admin assistant can do |
| `content.versions_*` | `versions_list` / `version_get` / `version_restore` | record version history over MCP, for every plugin's collections — list snapshots, read one, or restore it (a restore applies the full snapshot and records itself as a new version) |
| `cms.*` | `cms.page.slots.list` / `cms.page.slots.set` | **named slots**: "the second gallery image" instead of raw block JSON; writes go through the same service the admin visual editor uses |
| `ecommerce.*` | products list/get/**update**, orders list/get/**updateStatus** | writes run the canonical admin paths — collection hooks fire, order-status transitions are guarded (terminal states are final) |
| `mlm.*`, `logistics.*`, `finance.*` | partners, commissions, shipments, invoices | read-only; PII-tiered projections |

The list a client sees is always **live** — the scope picker and `tools/list` are derived from
whatever is registered at that moment, so a newly installed plugin's tools appear with zero
configuration.

## Connecting Claude

**Claude Code, local stdio** (recommended for development). Drop a `.mcp.json` next to where you run
`claude` (never commit it — it holds a live token):

```json
{
  "mcpServers": {
    "fromcode": {
      "command": "node",
      "args": ["packages/mcp-server/dist/bin.js"],
      "env": {
        "ATLANTIS_API_URL": "http://localhost:3000/api/v1",
        "ATLANTIS_API_TOKEN": "<token from Settings → Integrations → MCP>"
      }
    }
  }
}
```

`ATLANTIS_API_URL` is the FULL api base — origin plus the versioned prefix your deployment serves.

Restart Claude Code and run `/mcp` — the fromcode server lists its tools. From there, plain requests
("list the vision-board image slots", "show pending orders") route through the tools automatically.

**Claude Code, hosted endpoint** (production — no local binary). Enable **Remote access** in the
admin first, then:

```bash
claude mcp add --transport http fromcode https://api.<your-domain>/api/v1/mcp \
  --header "x-api-key: <token>"
```

**claude.ai web/desktop custom connectors** authenticate via OAuth and cannot send a custom
`x-api-key` header — connecting claude.ai directly needs an OAuth layer in front of the endpoint
(not shipped yet). Claude Code works with both transports today.

Mint **one token per purpose**, scoped tight: a content-editing token gets `content.* media.* cms.*`;
a reporting token gets `ecommerce.* finance.*`; nothing routine gets `deploy.*`. Revoking a token in
the admin cuts access instantly.

## Plugin tool packs

A plugin ships its own tools from `on-init.ts` — no framework changes, no registration files:

```ts
import { McpSchema } from '@fromcode119/sdk';

context.mcp.registerTools([
  {
    tool: 'myplugin.things.list',            // only `<own-slug>.*` — anything else throws at boot
    title: 'List things',
    description: 'List this plugin\'s things, newest first.',
    readOnly: true,
    permission: 'content:read',              // checked against the caller's roles on every call
    inputSchema: McpSchema.object({
      limit: McpSchema.number({ description: 'Things to return, 1-100.' }),
    }),
    handler: async (input, { user }) => ({ items: [] }),
  },
]);
```

The registry enforces the namespace boundary (a plugin can never shadow another plugin's or the
framework's tools), a re-initialised plugin *replaces* its previous registration instead of
colliding with it, and a tool without a schema or permission is hidden rather than callable.
Writes that must fire collection lifecycle hooks (licensing, ledger, search listeners) go through
`context.collections.update(slug, id, data, { user })` — the same controller path an admin save
takes — never through raw `context.db.update`.

## AI hooks in the kernel

The MCP tool surface above is one side of "AI-native" — an agent driving the platform. The other
side is AI *inside* the platform, available to every plugin without managing credentials:

| Capability | Description |
|------------|-------------|
| **LLM Provider Hooks** | Built-in integration points for OpenAI, Anthropic, Ollama and compatible APIs. |
| **Vector Operations** | First-class support for embedding generation and similarity search. Plug in any vector DB. |
| **Content Pipeline Hooks** | Kernel-level hooks for pre/post content processing — run summarization, tagging, or moderation automatically. |
| **AI in Plugins** | Any plugin can register AI-powered actions via the `context.ai` API without managing credentials. |
