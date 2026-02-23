# Package Module: @fromcode/plugins

- Version: `0.1.0`
- Path: `framework/Source/packages/plugins`

## Purpose

Shared plugin framework utilities and contracts for plugin runtime code.

## Workspace Commands

- `npm run build --workspace=@fromcode/plugins`
- `npm run dev --workspace=@fromcode/plugins`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
