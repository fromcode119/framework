# Package Module: @fromcode119/extension-builder

- Path: `packages/extension-builder`

## Purpose

Builds plugins, themes and appearances — the build pipeline, the SSR dependency closure, and integrity stamping.

Node-only build tooling, never imported by application code, and never by a plugin: a plugin reaches it through `context.extensions`.

## Workspace Commands

- `npm run build --workspace=@fromcode119/extension-builder`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
