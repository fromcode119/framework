# Package Module: @fromcode119/arch-guard

- Path: `packages/arch-guard`
- Binary: `arch-guard`

## Purpose

Architecture boundary enforcement — who may import what, which layer may call which, and the shape a plugin/theme/appearance must keep.

Its guards encode this project's own rules, so unlike `react-class-components`, `next-build-codegen` and `typescript-multiple-inheritance` there is nothing here another repository could reuse. Node-only build tooling, never imported by application code.

## Workspace Commands

- `npm run build --workspace=@fromcode119/arch-guard`

## Integration Notes

- Keep package responsibilities framework-generic (avoid plugin/theme business logic in package internals).
- Use plugin hooks/collections for domain features; use package APIs for shared runtime concerns.
- Validate with package-local build/test commands before full workspace build.

## Related Docs

- [Module index](../README.md)
- [Architecture](../../architecture.md)
- [Plugin development guide](../../plugin-development-guide.md)
