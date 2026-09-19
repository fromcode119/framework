# Package Module: @fromcode119/marketplace-client

- Path: `packages/marketplace-client`

## Purpose

Marketplace client utilities for discovering/installing external plugins/themes.

## Workspace Commands

- `npm run build --workspace=@fromcode119/marketplace-client`
- `npm run dev --workspace=@fromcode119/marketplace-client`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Architecture](../../architecture.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
