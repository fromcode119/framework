# Package Module: @fromcode119/api

- Path: `packages/api`

## Purpose

Main backend API runtime that loads plugins/themes, exposes REST APIs, handles auth/session/security, and orchestrates hooks.

## Workspace Commands

- `npm run build --workspace=@fromcode119/api`
- `npm run dev --workspace=@fromcode119/api`
- `npm run start --workspace=@fromcode119/api`
- `npm run test --workspace=@fromcode119/api`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Architecture](../../architecture.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
