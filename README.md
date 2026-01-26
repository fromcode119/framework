# Fromcode Framework

The "WordPress of TypeScript" - a plugin-first, enterprise-grade framework.

## Documentation
- [Framework Plan](docs/framework-plan.md) - Detailed technical architecture and vision.
- [Development Roadmap](docs/framework-roadmap.md) - Current progress and future tasks.

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
import { definePlugin } from '@fromcode/sdk';

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
