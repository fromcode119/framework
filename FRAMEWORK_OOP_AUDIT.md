# Framework OOP Conversion — Scope & Risk Audit

> Requested after the plugin/theme OOP migration. **Decision pending** — no framework
> code converted yet. This documents scope + risk so the conversion can be approved (or
> scoped down) deliberately, since the framework is the core engine, not extension code.

## Scope (component files in `framework/Source/packages`)

| Package | `.tsx` files | `export const … React.FC` / arrow | `export function` | already classes | Notes |
|---|---|---|---|---|---|
| **admin** | 172 | 47 | 29 (+ more via `export default function`) | 0 | The bulk + highest risk — the admin authoring panel |
| **frontend** | 35 | 0 | 0 (Next.js pages use `export default function Page`) | 9 | Next.js app-router pages/clients |
| **react** | 9 | 0 | 1 | 7 | SDK runtime (mostly already classes) |
| **core** | 2 | 0 | 0 | 2 | — |
| **sdk** | 1 | 0 | 1 | 0 | — |

≈ **95+ component files** to convert (admin dominates: ~76).

## Hook usage (conversion difficulty)

Across framework `.tsx` components: **useState ×423, useEffect ×171, useMemo ×72, useRef ×47, useCallback ×29.**

The framework is **hook-dense** — admin forms, the block/visual editor, collection list/detail
views, settings panels. Hooks are the idiomatic, correct React pattern here.

## Why the framework is materially different from plugins/themes

1. **It is the core engine, not extension code.** The "no `export function`/hook-free class"
   rule was introduced for *plugin/theme authors* writing extension surfaces. `CLAUDE.md`
   already states framework internals follow different conventions (e.g. snake_case DB access
   via the raw manager).
2. **No `ThemeRuntime` escape hatch.** Themes could route all hooks through one provider because
   they *consume* framework contexts. The framework *defines* those contexts — there is no
   higher layer to hoist hooks into. Hook-free classes here would need bespoke
   `Context.Consumer` plumbing per component, and many admin components legitimately need
   `useState`/`useEffect` (editors, async forms).
3. **Baked into the Docker image.** Unlike mounted plugins/themes (live edits), framework
   packages are compiled into `framework-admin-1`/`frontend-1`. **Every change requires a
   framework rebuild + redeploy (~15–30 min)** and risks breaking the admin panel — the tool
   used to author everything.
4. **Effort/benefit.** ~95 hook-heavy components × careful conversion + redeploys is a multi-day,
   high-regression effort on the most critical surface, with limited benefit (it isn't the
   author-facing extension code the rule targets).

## Recommendation

**Do not de-hook the framework components.** Keep the strict hook-free-class rule scoped to
plugins/themes (extension code), where it's already done and verified.

If some consistency in the framework is still wanted, a **low-risk** subset is reasonable:
- **"One export per file"** for the multi-export files (mechanical, no behavior change).
- Convert the handful of **purely presentational** framework components (no hooks) to classes.
- Leave hook-bearing admin/editor components as idiomatic function components.

This gives naming/structure consistency without rewriting the core authoring tool or forcing
repeated redeploys.

## If full conversion is still desired

Sequence it like the theme: smallest packages first (`sdk`, `react`, `core`), then `frontend`
pages, then `admin` in sub-areas (collection list/detail, settings, editor) — each followed by a
framework rebuild + redeploy + admin smoke test. Budget days, not hours.
