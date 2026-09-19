# Package Module: @fromcode119/mcp-server

- Path: `packages/mcp-server`
- Binary: `atlantis-mcp`

## Purpose

The standalone Model Context Protocol server binary — stdio transport plus a Streamable HTTP client.

Every installation can act as an MCP server for AI agents; see the [MCP server guide](../../mcp-server.md) for the security model and tool surface.

## Workspace Commands

- `npm run build --workspace=@fromcode119/mcp-server`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
