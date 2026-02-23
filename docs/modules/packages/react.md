# Package Module: @fromcode119/react

- Version: `0.1.0`
- Path: `framework/Source/packages/react`

## Purpose

Shared React components/slot system used by admin/frontend/plugin UIs.

## Workspace Commands

- `npm run build --workspace=@fromcode119/react`
- `npm run dev --workspace=@fromcode119/react`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
