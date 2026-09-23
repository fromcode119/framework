# Documentation Site

Welcome to the Atlantis documentation. This site provides everything you need to build, extend, and deploy your platform.

## 📖 Navigation

### [Installation Guide](./installation.md)
Every supported way to install and run Atlantis — local Docker, local Node dev, a production server with zero checkout, Coolify, or a manual image build.

### [Configuration](./configuration.md)
Every environment variable: core settings, the database, cache/queue/storage/email integrations, multi-site/gateway, rate limiting.

### [Architecture](./architecture.md)
The Hooked Kernel Architecture, request flow, and the kernel subsystems — security & identity, infrastructure, database layer, multi-site tenancy, admin appearances, i18n, class-based conventions — plus the repository structure.

### [Comparison — Why Atlantis?](./comparison.md)
How Atlantis compares to WordPress, Strapi, Payload, Ghost/Directus, and NestJS/Express.

### [Build & CLI](./cli.md)
Build commands, architecture-check gates, the `atlantis`/`fromcode` CLI command reference, and run modes.

### [MCP Server](./mcp-server.md)
Every Atlantis installation as a Model Context Protocol server: security model, tool surface, connecting Claude, shipping a plugin's own tools, and the kernel's built-in AI hooks.

### [Module Documentation Index](./modules/README.md)
Framework package documentation index.

### [Backup And Site Transfer](./backup-and-transfer.md)
Operator guide for the system backup API, constrained restore flow, and site-transfer bundle CLI.

### [Certificates and TLS](./certificates-and-tls.md)
How the platform serves HTTPS: uploading a certificate, where keys are stored, expiry warnings, and the vendor-neutral contract an edge proxy consumes.

### [Site Visibility and Preview](./site-visibility-and-preview.md)
What private/unlisted/public actually do, and how a site's own people see it before it is published — including why that needs a one-time link rather than a permission check.

### [Plugin Development Guide](./plugin-development-guide.md)
The plugin ecosystem, plugin structure, and cross-plugin communication rules — plus how to create your own plugins, register collections, and hook into framework events.

### [API Reference](./api-reference.md)
Comprehensive documentation for the REST and GraphQL APIs.

### [Theme System](./capabilities.md)
Overview of how the theme system works, including component overrides and visual builder settings.

### [Frontend Integration](./frontend-plugin-flow.md)
Detailed look at how plugins interact with the Next.js frontend and the UI slot system.

### [Design System](./design-system.md)
The Brutalist-Soft design language for Atlantis plugin UIs.

## 📚 Reference

### Resources & Support

| Resource | Link |
|----------|------|
| 🔒 Security Policy | [SECURITY.md](../SECURITY.md) |
| 📜 License | [LICENSE](../LICENSE) (MIT) |
| 🤝 Contributing | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| 🛡️ Security Monitor source | [packages/core/src/security/](../packages/core/src/security/) |
| 📦 SDK Contract source | [packages/sdk/](../packages/sdk/) |
| 🐛 Issues | [GitHub Issues](https://github.com/fromcode119/framework/issues) |

---

## 🚀 Concept Overview

Atlantis is a **plugin-first** framework. This means the core kernel is kept minimal, handles security and data orchestration, while all functional features (content, commerce, search optimisation) are implemented as self-contained plugins.

### Key Architecture Pieces
- **Kernel (@fromcode119/core)**: Plugin loader, hook manager, and security sandbox.
- **Admin Panel (@fromcode119/admin)**: A dynamic React/Next.js interface that adapts based on enabled plugins.
- **Marketplace**: A distribution hub for sharing and installing plugins and themes.
- **SDK**: Tools for local development, testing, and building assets.

## 🛠️ Developer Resources
- **Command Line Interface**: `atlantis dev`, `atlantis plugin create`.
- **Hooks & Events**: Extend system behavior without modifying core files.
- **Component Overrides**: Replace any part of the UI from your theme or plugin.
