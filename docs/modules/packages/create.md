# Package Module: @fromcode119/create

- Path: `packages/create`
- Binary: `create-fromcode`

## Purpose

The `npm create` scaffolder for a new Atlantis app.

It writes a project that depends on the published packages rather than a checkout of this repository.

## Workspace Commands

This package declares no scripts of its own; it is consumed through its `bin` entry.

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
