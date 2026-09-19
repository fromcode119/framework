# Package Module: @fromcode119/cli

- Path: `packages/cli`

## Purpose

Framework CLI package used for local tooling and automation commands.

## Workspace Commands

- `npm run build --workspace=@fromcode119/cli`
- `npm run dev --workspace=@fromcode119/cli`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Architecture](../../architecture.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
