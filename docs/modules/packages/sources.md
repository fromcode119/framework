# Package Module: @fromcode119/sources

- Path: `packages/sources`

## Purpose

Build sources — connect a git provider, build a plugin, theme or appearance from it, and publish the resulting package into the catalog.

Also owns update checks and the build artifact/download hooks behind the admin's Sources screen.

## Workspace Commands

- `npm run build --workspace=@fromcode119/sources`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
