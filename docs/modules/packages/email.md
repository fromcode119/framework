# Package Module: @fromcode119/email

- Path: `packages/email`

## Purpose

Email transport abstraction and provider drivers used by auth/forms/system notifications.

## Workspace Commands

- `npm run build --workspace=@fromcode119/email`
- `npm run dev --workspace=@fromcode119/email`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Architecture](../../architecture.md)
- [Module index](../README.md)
- [Plugin development guide](../../plugin-development-guide.md)
