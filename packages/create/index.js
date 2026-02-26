#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ─── Argument parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const withFrontend = true; // Always include frontend by default

const projectName = args[0];
if (!projectName) {
  console.error('Usage: npx @fromcode119/create <project-name>');
  console.error('');
  console.error('  Creates a new Fromcode project with API, Admin and Frontend.');
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(projectName)) {
  console.error(`Invalid project name "${projectName}". Use lowercase letters, numbers and hyphens.`);
  process.exit(1);
}

const dest = path.resolve(process.cwd(), projectName);
if (fs.existsSync(dest)) {
  console.error(`Directory "${projectName}" already exists.`);
  process.exit(1);
}

// ─── Template helpers ────────────────────────────────────────────────────────

const TEMPLATE_DIR = path.resolve(__dirname, 'template');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function writeTemplate(name, content) {
  const filePath = path.join(dest, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\{\{PROJECT_NAME\}\}/g, projectName), 'utf8');
}

// ─── File generation ─────────────────────────────────────────────────────────

console.log(`\nCreating Fromcode project in ./${projectName} ...\n`);

fs.mkdirSync(dest, { recursive: true });

// Copy static template files
if (fs.existsSync(TEMPLATE_DIR)) {
  copyDir(TEMPLATE_DIR, dest);
  // Rename template gitignore (npm strips .gitignore from packages)
  const tplGitignore = path.join(dest, 'gitignore');
  if (fs.existsSync(tplGitignore)) {
    fs.renameSync(tplGitignore, path.join(dest, '.gitignore'));
  }
}

// ─── package.json ────────────────────────────────────────────────────────────

const pkgDeps = {
  "@fromcode119/api": "^0.1.30",
};

const devScripts = {
  "dev": `concurrently -n proxy,api,admin,web -c white,cyan,green,yellow "PROXY_PORT=3000 API_PORT=4000 ADMIN_PORT=3001 FRONTEND_PORT=3002 node proxy.js" "PORT=4000 fromcode-api" "NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=3001 fromcode-admin" "NEXT_PUBLIC_API_URL=http://localhost:3000 PORT=3002 fromcode-frontend"`,
  "dev:api": "PORT=4000 fromcode-api",
  "start": `concurrently -n proxy,api,admin,web -c white,cyan,green,yellow "PROXY_PORT=3000 API_PORT=4000 ADMIN_PORT=3001 FRONTEND_PORT=3002 node proxy.js" "NODE_ENV=production PORT=4000 fromcode-api" "NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=3001 fromcode-admin" "NEXT_PUBLIC_API_URL=http://localhost:3000 PORT=3002 fromcode-frontend"`,
  "start:api": "NODE_ENV=production PORT=4000 fromcode-api",
  "plugin:build": "fromcode plugin build",
  "plugin:dev": "fromcode plugin dev",
  "theme:build": "fromcode theme build",
  "db:migrate": "fromcode db:migrate",
  "db:reset": "fromcode db:reset",
};

// Remove undefined entries
for (const key of Object.keys(devScripts)) {
  if (devScripts[key] === undefined) delete devScripts[key];
}

const pkg = {
  name: projectName,
  version: "0.1.0",
  description: `${projectName} — a Fromcode app`,
  private: true,
  scripts: devScripts,
  dependencies: pkgDeps,
  devDependencies: {
    "@fromcode119/cli": "^0.1.30",
    "concurrently": "^8.2.2",
    "http-proxy": "^1.18.1",
    "typescript": "^5.3.3",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/node": "^20.11.0"
  },
};

fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// ─── .env (from the shared template) ─────────────────────────────────────────

const envContent = [
  '# Fromcode environment config — edit JWT_SECRET before going live',
  '# See .env.example for all available options',
  '',
  'DB_DIALECT=sqlite',
  'DATABASE_URL=file:./data/app.db',
  '',
  '# Set a real random string (min 32 chars)',
  'JWT_SECRET=change-me-at-least-32-chars-before-going-live',
  '',
  'REDIS_URL=',
  '',
  'PUBLIC_URL=http://localhost:3000',
  'NEXT_PUBLIC_API_URL=http://localhost:3000',
  'NEXT_PUBLIC_ADMIN_BASE_PATH=/admin',
  'API_URL=http://localhost:4000',
  'INTERNAL_API_URL=http://localhost:4000',
  '',
  'PROXY_PORT=3000',
  'API_PORT=4000',
  'ADMIN_PORT=3001',
  'FRONTEND_PORT=3002',
  '',
  'NODE_ENV=development',
  '',
].join('\n');

fs.writeFileSync(path.join(dest, '.env'), envContent, 'utf8');

// ─── Placeholder dirs ─────────────────────────────────────────────────────────

for (const dir of ['plugins', 'themes', 'data']) {
  fs.mkdirSync(path.join(dest, dir), { recursive: true });
  fs.writeFileSync(path.join(dest, dir, '.gitkeep'), '', 'utf8');
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`  ✓  ${projectName}/package.json`);
console.log(`  ✓  ${projectName}/.env  (edit JWT_SECRET before going live)`);
console.log(`  ✓  ${projectName}/proxy.js`);
console.log(`  ✓  ${projectName}/plugins/  themes/  data/`);
if (withFrontend) {
  console.log(`  ✓  --frontend: fromcode-frontend included`);
}
console.log('');
console.log('Next steps:');
console.log('');
console.log('  1. Authenticate with GitHub Packages:');
console.log('     Create a classic personal access token with "read:packages" scope:');
console.log('     https://github.com/settings/tokens');
console.log('');
console.log('     Then either:');
console.log('       A) Export it as an environment variable:');
console.log('          export GITHUB_TOKEN=ghp_...');
console.log('');
console.log('       B) Or add it directly to this project:');
console.log(`          cd ${projectName}`);
console.log('          echo "//npm.pkg.github.com/:_authToken=ghp_..." >> .npmrc');
console.log('');
console.log(`  2. Final steps:`);
console.log('     npm install');
console.log('     npm run dev');
console.log('');
console.log('  Then open: http://localhost:3000/admin');
console.log('');
