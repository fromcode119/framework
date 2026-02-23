# Package Module: @fromcode/database

- Version: `0.1.0`
- Path: `framework/Source/packages/database`

## Purpose

Database abstraction and persistence layer helpers used by API/plugins.

## Workspace Commands

- `npm run build --workspace=@fromcode/database`
- `npm run dev --workspace=@fromcode/database`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
