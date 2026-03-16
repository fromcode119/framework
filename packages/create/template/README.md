# {{PROJECT_NAME}}

A [Fromcode](https://fromcode.com) headless CMS application.

## Getting started

```bash
export GITHUB_TOKEN=<YOUR_GITHUB_TOKEN>
npm install
npm run dev
```

Then open [http://localhost:3000/admin](http://localhost:3000/admin).

`npm run dev` is extension mode (API + Admin only).

Use full app mode when you also need the storefront frontend:

```bash
npm run dev:full
```

## Configuration

Edit `.env` before going live. At minimum, change `JWT_SECRET` to a random string of at least 32 characters.

Local `.env` files are for your machine only. Keep `.env` untracked, use `.env.example` as the source of truth for placeholders, and provide `GITHUB_TOKEN` via your shell environment instead of committing it.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API + Admin on http://localhost:3000 |
| `npm run dev:full` | Start API + Admin + Frontend on http://localhost:3000 |
| `npm run dev:api` | Start only the API |
| `npm run start` | Production start for API + Admin |
| `npm run start:full` | Production start for API + Admin + Frontend |
| `npm run plugin:dev -- <slug>` | Watch/rebuild a plugin UI bundle |
| `npm run theme:dev -- <slug>` | Watch/rebuild a theme UI bundle |

## Adding plugins

Drop a plugin directory into `plugins/` or install from the marketplace:

```bash
npx fromcode plugin install <slug>
```

## Adding themes

Drop a theme directory into `themes/` or install from the marketplace:

```bash
npx fromcode theme install <slug>
```

### One-Package Theme (Theme + Plugins)

You can ship required plugins inside the same theme ZIP.

1. Build and pack each required plugin:

```bash
npx fromcode plugin pack cms
npx fromcode plugin pack forms
```

2. Place plugin ZIPs inside the theme folder (recommended: `plugins/`):

```text
themes/my-theme/
  theme.json
  ui/
  plugins/
    plugin-cms-1.5.0.zip
    plugin-forms-1.0.0.zip
```

3. Optionally declare them explicitly in `theme.json`:

```json
{
  "slug": "my-theme",
  "version": "1.0.0",
  "bundledPlugins": [
    "plugins/plugin-cms-1.5.0.zip",
    "plugins/plugin-forms-1.0.0.zip"
  ],
  "dependencies": {
    "cms": "^1.5.0",
    "forms": "^1.0.0"
  }
}
```

4. Pack theme:

```bash
npx fromcode theme pack my-theme
```

When this theme is activated/reset, bundled plugin ZIPs are installed first, then any remaining dependencies are installed from marketplace.
