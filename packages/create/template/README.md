# {{PROJECT_NAME}}

A [Fromcode](https://fromcode.com) headless CMS application.

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000/admin](http://localhost:3000/admin).

## Configuration

Edit `.env` before going live. At minimum, change `JWT_SECRET` to a random string of at least 32 characters.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API + Admin (and Frontend if configured) on http://localhost:3000 |
| `npm run dev:api` | Start only the API on port 4000 |
| `npm run start` | Production start (requires `npm run build` first for Next.js apps) |

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
