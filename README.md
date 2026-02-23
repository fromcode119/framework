# Fromcode Framework

The "WordPress of TypeScript" - a plugin-first, enterprise-grade framework.

## Prerequisites
- **Node.js**: v22.0.0 or later (Required for `isolated-vm` based plugin sandboxing)
- **npm**: v11.0.0 or later (Recommended)
- **Docker**: For production-ready builds and orchestration

## Documentation
- [Global Setup Guide](docs/setup/global-setup.md) - Canonical local setup with framework domains and workspace services.
- [Module Documentation Index](docs/modules/README.md) - Framework package operational docs.
- [Plugin Development Guide](docs/plugin-development-guide.md) - Creating plugins, collections, hooks, and capabilities.
- [API Reference](docs/api-reference.md) - REST API documentation.

## Structure

- `packages/core`: Minimal kernel (plugin loader, lifecycle).
- `packages/sdk`: Tools for plugin development.
- `packages/react`: UI components like `<Slot />`.
- `packages/next`: Next.js/SSR integration.
- `packages/cli`: `fromcode` command-line tool.
- `packages/database`: Database abstraction layer.
- `packages/auth`: Authentication and permissions.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build all packages:
   ```bash
   npm run build
   ```

## Creating a Plugin

```typescript
import { definePlugin } from '@fromcode119/sdk';

export default definePlugin({
  manifest: {
    name: 'My Plugin',
    slug: 'my-plugin',
    version: '1.0.0'
  },
  async onEnable(ctx) {
    ctx.logger.info('Enabled!');
  }
});
```

## Runtime Extensions & Icons

Fromcode supports a decentralized, metadata-driven extension model for runtime libraries like icon packs.

### Adding a New Icon Pack (e.g., FontAwesome)

1. **Register in Plugin Manifest**:
   In your plugin's `manifest.json`, define the bridge:
   ```json
   {
     "slug": "my-icons-plugin",
     "runtimeModules": ["fontawesome"]
   }
   ```
   *Note: The framework automatically maps these to centralized ESM bridges.*

2. **Register the Provider**:
   In your plugin's UI entry point:
   ```javascript
   import * as FA from './lib/fa-icons.js';
   import { FrameworkIconRegistry } from '@fromcode119/react';

   FrameworkIconRegistry.registerProvider('fontawesome', FA);
   ```

3. **Usage**:
   Once registered, icons are available via the bridge:
   ```tsx
   import { FaUser } from 'fontawesome';
   ```
   Or dynamically:
   ```tsx
   import { getIcon } from '@fromcode119/react';
   const Icon = getIcon('FaUser');
   ```
