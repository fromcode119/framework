# Package Module: @fromcode119/admin

- Version: `0.1.0`
- Path: `framework/Source/packages/admin`

## Purpose

Admin control panel application (Next.js) for managing collections, plugins, settings, and operational workflows.

## Workspace Commands

- `npm run build --workspace=@fromcode119/admin`
- `npm run dev --workspace=@fromcode119/admin`
- `npm run start --workspace=@fromcode119/admin`
- `npm run test --workspace=@fromcode119/admin`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
