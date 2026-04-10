# Security Policy

> **Important — Open Source Disclaimer**
>
> Fromcode is provided **as-is** under the MIT License. As an open-source project, **we make no warranties or guarantees** regarding security, fitness for purpose, or freedom from defects. By using Fromcode, you accept full responsibility for securing your own deployment. The maintainers are not liable for any damages, data breaches, or losses arising from use of this software.
>
> We will make **best-effort** attempts to address reported vulnerabilities, but there are no SLAs, no guaranteed patch timelines, and no obligation to act on any report.

## Supported Versions

Only the latest stable release of Fromcode receives best-effort security attention.

| Version | Status          |
|---------|-----------------|
| Latest  | Best effort ✅  |
| Older   | No support ❌   |

## Reporting a Vulnerability

**Please do not report security vulnerabilities in public GitHub Issues.**

If you discover a security vulnerability, you may report it responsibly:

1. **Email**: security@fromcode.com
2. **Subject**: `[SECURITY] Brief description of the issue`
3. **Include**:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce or a proof-of-concept (if possible)
   - Your suggested fix or mitigation (optional)

We will acknowledge reports when we can, but **cannot guarantee a response time or resolution**. This is a community-maintained project.

We ask that you:
- Allow reasonable time before public disclosure
- Avoid accessing or modifying data that does not belong to you
- Act in good faith

## Scope

The following are **in scope**:

- `packages/api` — REST API server
- `packages/admin` — Admin panel
- `packages/core` — Kernel: auth, RBAC, security monitor
- `packages/sdk` — Public SDK used by plugins/themes
- Plugin code under `plugins/`
- Theme code under `themes/`

The following are **out of scope**:

- Third-party dependencies (report directly to those projects)
- Issues already publicly disclosed
- Denial-of-service attacks
- Social engineering

## Security Architecture

Fromcode has several built-in security layers you should be aware of when researching:

- **Security Monitor** — Real-time threat detection loop (`packages/core/src/security/`)
- **Plugin Sandboxing** — Plugins run with declared capabilities only via `SandboxManager`
- **Cryptographic Signing** — All plugins must pass signature verification on load
- **RBAC** — Role-based access control enforced at the kernel level
- **MFA / TOTP** — Native two-factor authentication with encrypted secret storage
- **Audit Logging** — Comprehensive audit trail for all admin and auth actions
- **Rate Limiting** — Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`
- **Input Validation** — Zod schemas enforced at all API controller boundaries
- **JWT Rotation** — Short-lived access tokens with refresh token rotation

## Disclosure Policy

We follow **coordinated disclosure** on a best-effort basis. If and when a fix is released, we may publish a security advisory crediting the reporter (unless they request anonymity). We are not obligated to publish advisories or release fixes on any schedule.

## No Warranty

This project is open source. **Use at your own risk.** See [LICENSE](LICENSE) for full terms.
