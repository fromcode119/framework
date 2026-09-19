# Package Module: @fromcode119/ai

- Path: `packages/ai`

## Purpose

Admin Assistant runtime — LLM clients, the request classifier, and the MCP tool packs the assistant is allowed to call.

The assistant is a framework capability rather than a plugin: it answers about whatever is installed, so it cannot live inside any one of them.

## Workspace Commands

- `npm run build
dev
test --workspace=@fromcode119/ai`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
