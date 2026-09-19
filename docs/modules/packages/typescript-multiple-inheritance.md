# Package Module: @fromcode119/typescript-multiple-inheritance

- Path: `packages/typescript-multiple-inheritance`
- Binary: `tsmi`, `typescript-multiple-inheritance`

## Purpose

Extends TypeScript's type system for real OOP — multiple inheritance for classes, so a data shape never has to stay an interface. Zero runtime dependencies; standalone like react-class-components and next-build-codegen.


## Workspace Commands

- `npm run build --workspace=@fromcode119/typescript-multiple-inheritance`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
