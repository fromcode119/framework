# Package Module: @fromcode119/next-build-codegen

- Path: `packages/next-build-codegen`
- Binary: `next-build-codegen`

## Purpose

Next.js + build integration for @fromcode119/react-class-components — `.client` directive injection and the Registry-resolved JSX template compiler. Keeps react-class-components pure React; all build/Next-specific machinery lives here.

## Workspace Commands

- `npm run build --workspace=@fromcode119/next-build-codegen`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
