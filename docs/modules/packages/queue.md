# Package Module: @fromcode119/queue

- Path: `packages/queue`

## Purpose

Background job queue — BullMQ or an in-process adapter behind one API, chosen by configuration.

## Workspace Commands

- `npm run build
dev --workspace=@fromcode119/queue`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
