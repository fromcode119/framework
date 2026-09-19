# Package Module: @fromcode119/mcp

- Path: `packages/mcp`

## Purpose

MCP schema, registry and bridge primitives, shared by the MCP server and by every client that speaks to it.

## Workspace Commands

- `npm run build
dev --workspace=@fromcode119/mcp`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
