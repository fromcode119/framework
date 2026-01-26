# Minimal fromcode Project

This is a minimal fromcode project scaffolded with the `fromcode create` CLI.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment:
   ```bash
   cp .env.example .env
   ```

3. Start the development environment:
   ```bash
   npm run dev
   ```

3. Create your first plugin:
   ```bash
   npm run plugin:create
   ```

## Structure

- `plugins/`: Your custom plugins.
- `public/`: Static assets.
- `docker-compose.yml`: Infrastructure (Postgres, Redis).
- `package.json`: Project dependencies and scripts.
