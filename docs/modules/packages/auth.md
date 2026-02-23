# Package Module: @fromcode119/auth

- Version: `0.1.0`
- Path: `framework/Source/packages/auth`

## Purpose

Authentication and authorization primitives shared across runtime modules.

## Workspace Commands

- `npm run build --workspace=@fromcode119/auth`
- `npm run dev --workspace=@fromcode119/auth`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
