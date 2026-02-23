# Package Module: @fromcode119/cache

- Version: `0.1.0`
- Path: `framework/Source/packages/cache`

## Purpose

Caching abstractions and runtime adapters used by API/services.

## Workspace Commands

- `npm run build --workspace=@fromcode119/cache`
- `npm run dev --workspace=@fromcode119/cache`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
