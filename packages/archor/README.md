# @fromcode119/archor

Architecture boundary enforcement, standalone like `reactor` / `nextor` / `typor`.

Where the others own a technology — React, Next, TypeScript — archor owns the **rules between the parts**:

- a plugin may import only `@fromcode119/sdk`, never `core`/`database`/`api` directly
- a plugin never reads or writes a framework system table
- `db.find` / `db.count` filters live under `where:{}` — a top-level filter is silently ignored
- layer order: route → controller → service → repository, with file-size limits
- a theme override may not reach outside the theme; an appearance may not reach into plugin internals

These are policy, not types — which is why they are not typor's. Each rule is a class; the `archor-*.mjs`
files are thin CLIs over them.

## Note on `noImplicitAny`

The guards were ported verbatim from JavaScript so their output could be proven identical to the scripts
they replace. That leaves untyped parameters, so `noImplicitAny` is off for this package only. Typing them
is a follow-up — it must not change any count, so it is done after parity is established, not during.
