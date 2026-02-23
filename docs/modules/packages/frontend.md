# Package Module: @fromcode119/frontend

- Version: `0.1.0`
- Path: `framework/Source/packages/frontend`

## Purpose

Public-facing frontend (Next.js) that resolves CMS/plugin content and renders theme UI.

## Workspace Commands

- `npm run dev --workspace=@fromcode119/frontend`
- `npm run build --workspace=@fromcode119/frontend`
- `npm run start --workspace=@fromcode119/frontend`
- `npm run lint --workspace=@fromcode119/frontend`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
