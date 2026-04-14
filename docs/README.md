# Documentation Site

Welcome to the Fromcode Framework documentation. This site provides everything you need to build, extend, and deploy your platform.

## 📖 Navigation

### [Global Setup Guide](./setup/global-setup.md)
Canonical environment and runtime setup using local framework domains, Docker, and workspace scripts.

### [Module Documentation Index](./modules/README.md)
Framework package documentation index.


### [Installation Guide](./installation.md)
Learn how to set up the framework locally and in production environment.

### [Backup And Site Transfer](./backup-and-transfer.md)
Operator guide for the system backup API, constrained restore flow, and site-transfer bundle CLI.

### [Plugin Development Guide](./plugin-development-guide.md)
Discover how to create your own plugins, register collections, and hook into framework events.

### [API Reference](./api-reference.md)
Comprehensive documentation for the REST and GraphQL APIs.

### [Theme System](./capabilities.md)
Overview of how the theme system works, including component overrides and visual builder settings.

### [Frontend Integration](./frontend-plugin-flow.md)
Detailed look at how plugins interact with the Next.js frontend and the UI slot system.

---

## 🚀 Concept Overview

Fromcode is a **plugin-first** framework. This means the core kernel is kept minimal, handles security and data orchestration, while all functional features (CMS, E-commerce, SEO) are implemented as self-contained plugins.

### Key Architecture Pieces
- **Kernel (@fromcode119/core)**: Plugin loader, hook manager, and security sandbox.
- **Admin Panel (@fromcode119/admin)**: A dynamic React/Next.js interface that adapts based on enabled plugins.
- **Marketplace**: A distribution hub for sharing and installing plugins and themes.
- **SDK**: Tools for local development, testing, and building assets.

## 🛠️ Developer Resources
- **Command Line Interface**: `fromcode dev`, `fromcode plugin create`.
- **Hooks & Events**: Extend system behavior without modifying core files.
- **Component Overrides**: Replace any part of the UI from your theme or plugin.
