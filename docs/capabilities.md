# Plugin Capabilities Reference

This document lists all available capabilities that a plugin can request in its `manifest.json`. Capabilities are used to grant security permissions and access to specific framework services via the `PluginContext`.

## Capability List

| Capability | Description | Context API Access |
|------------|-------------|--------------------|
| `*` | **Root/Superuser**: Grants all permissions. Use with extreme caution. | All APIs |
| `api` | Allows the plugin to register custom HTTP routes. | `ctx.api.*` |
| `database` | Full database access (Read + Write). | `ctx.db.*` |
| `database:read` | Read-only database access. | `ctx.db.select()`, etc. |
| `database:write` | Permission to modify database schemas or data. | `ctx.db.insert()`, `ctx.db.update()`, etc. |
| `content` | Permission to register and manage Content Collections. | `ctx.collections.*` |
| `filesystem:read` | Read access to the plugin's data directory. | `ctx.storage.*` |
| `filesystem:write`| Write access to the plugin's data directory. | `ctx.storage.*` |
| `storage` | Full access to the Storage/Media manager. | `ctx.storage.*` |
| `hooks` | Permission to emit and listen to system events. | `ctx.hooks.*`, `ctx.plugins.on`, `ctx.plugins.emit` |
| `email` | Permission to send emails via the system email service. | `ctx.email.*` |
| `cache` | Permission to use the Redis-backed cache (Namespaced). | `ctx.cache.*` |
| `jobs` | Permission to enqueue background jobs and register workers. | `ctx.jobs.*`, `ctx.redis.*` |
| `i18n` | Access to translation and localization services. | `ctx.i18n.*`, `ctx.t()` |
| `plugins:interact`| Permission to check state of other plugins or call their APIs. | `ctx.plugins.isEnabled`, `ctx.plugins.getAPI` |
| `redis:global` | **High Privilege**: Direct access to the global Redis keyspace. | `ctx.redis.global` |

## Usage in `manifest.json`

Capabilities are declared in the `capabilities` array of your plugin's `manifest.json`:

```json
{
  "slug": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "capabilities": [
    "api",
    "database:read",
    "jobs",
    "cache"
  ]
}
```

## Security & Isolation

The framework automatically enforces isolation for several capabilities:

- **Database**: `ctx.db` operations are restricted to tables prefixed with `fcp_[plugin_slug]_`.
- **Redis/Cache**: All keys are transparently prefixed with `redis:[plugin_slug]:` or `cache:[plugin_slug]:` unless the `redis:global` capability is used.
- **API**: Custom routes are automatically prefixed with `/api/[plugin_slug]/`.
- **Storage**: File operations are namespaced to prevent cross-plugin file modification.

## Governance

Requested capabilities are compared against the "Approved Capabilities" stored in the system database. If a plugin updates its manifest to request new capabilities, the platform will automatically move it to an `inactive` state until an administrator re-approves the "Capability Drift".
