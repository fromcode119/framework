# Package Module: @fromcode/api

- Version: `0.1.0`
- Path: `framework/Source/packages/api`

## Purpose

Main backend API runtime that loads plugins/themes, exposes REST APIs, handles auth/session/security, and orchestrates hooks.

## Workspace Commands

- `npm run build --workspace=@fromcode/api`
- `npm run dev --workspace=@fromcode/api`
- `npm run start --workspace=@fromcode/api`
- `npm run test --workspace=@fromcode/api`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Global setup](../../setup/global-setup.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
