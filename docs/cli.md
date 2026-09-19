# Build & CLI

## Build Commands

```bash
# Build the complete framework
npm run build

# Build individual targets
npm run build:api        # API TypeScript compilation
npm run build:admin      # Admin panel (Next.js)
npm run build:frontend   # Frontend (Next.js)
```

## Architecture Checks

```bash
# Check plugin layer violations (warn mode / strict)
npm run check:plugin-architecture
npm run check:plugin-architecture:strict

# SDK boundary audit — plugins/themes may import ONLY @fromcode119/sdk
npm run check:sdk-boundary
npm run audit:core-boundary

# db.find/db.count filters must live under where:{...}
npm run check:db-find-where

# Plugin admin UI must be hook-free OOP classes
npm run check:plugin-ui-hookfree

# Framework OOP conventions (class-based, no export const components)
npm run check:framework-oop

# Real type gate for the Next apps (next build does NOT typecheck)
npm run check:app-typecheck
```

## The Atlantis CLI

```bash
npm run atlantis -- <command>
```

Commands are grouped: `atlantis <group> <command>`.

| Command | Description |
|---------|-------------|
| `plugin create [name]` | Scaffold a new plugin with the correct structure in `plugins/` |
| `plugin build / pack / publish <slug>` | Build, tarball, or publish a plugin |
| `plugin install <slug>` / `plugin search` | Install from / search the marketplace |
| `theme create [name]` | Scaffold a new theme in `themes/` |
| `theme seed` | Seed theme configuration data (also `npm run seed:theme`) |
| `db migrate / rollback / seed / status / reset` | Atomic schema synchronization across all active plugins |
| `test / lint / typecheck / doctor` | Quality gates and environment diagnosis (top-level commands) |
| `system info / version / site-transfer-bundle` | Operations — including the full site-transfer bundle |
| `system gateway` | The platform gateway (container entrypoint of the `gateway` image): host routing from the site table |
| `node dist/cli/tenant-export.js --database … --uploads … --slug … --host …` | Read-only export of a single-site deployment into a site archive the Sites page can import |
| `auth …` | Account recovery operations (run in-container; see docs) |

## Run modes

| Mode | Command | Ports | Use Case |
|------|---------|-------|----------|
| **Full Stack** | `npm run start:all` | 3000, 3001, 3002 | Complete application with frontend theme |
| **API + Admin** | `npm run start:api-admin` | 3000, 3001 | Backend + admin UI, headless frontend |
| **API Only** | `npm run dev:local:api` | 3000 | Pure REST/GraphQL backend, maximum flexibility |
| **Local Dev** | `npm run dev:local` | 3000 (proxy) | All surfaces through a single local proxy |

> **Headless support**: Consume any Atlantis endpoint from your own React, Next.js, Vue, or native clients. No coupling to the bundled frontend.
