# Package Module: @fromcode119/react-class-components

- Path: `packages/react-class-components`

## Purpose

Class-based OOP primitives for React apps - a typed Reactor base component, @bound / @watch / @state decorators, and a method-bearing Enum base. React-only, zero framework dependencies, reusable in any project.


## Workspace Commands

- `npm run build --workspace=@fromcode119/react-class-components`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
