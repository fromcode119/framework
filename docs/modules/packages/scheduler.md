# Package Module: @fromcode119/scheduler

- Path: `packages/scheduler`

## Purpose

Scheduling/job orchestration primitives for background workflows.

## Workspace Commands

- `npm run build --workspace=@fromcode119/scheduler`
- `npm run dev --workspace=@fromcode119/scheduler`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Architecture](../../architecture.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
