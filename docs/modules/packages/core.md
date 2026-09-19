# Package Module: @fromcode119/core

- Path: `packages/core`

## Purpose

Kernel runtime (plugin manager, sandbox execution, hooks lifecycle, extension loading).

## Workspace Commands

- `npm run build --workspace=@fromcode119/core`
- `npm run dev --workspace=@fromcode119/core`
- `npm run test --workspace=@fromcode119/core`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Architecture](../../architecture.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
