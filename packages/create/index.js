#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ─── Argument parsing ────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const localMode = rawArgs.includes('--local');
const args = rawArgs.filter(a => !a.startsWith('--'));
const withFrontend = true; // Always include frontend by default
const workspaceRoot = path.resolve(__dirname, '..', '..');
const localWorkspaceRoot = process.env.FROMCODE_WORKSPACE_ROOT
  ? path.resolve(process.env.FROMCODE_WORKSPACE_ROOT)
  : workspaceRoot;
const localWorkspaceRootEscaped = localWorkspaceRoot
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"');

const projectName = args[0];
if (!projectName) {
  console.error('Usage: npx @fromcode119/create <project-name> [--local]');
  console.error('');
  console.error('  Creates a new Fromcode project with API, Admin and Frontend.');
  console.error('');
  console.error('  --local   Use local framework workspace packages (no npm registry).');
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
  // Apply basic variable replacement to README placeholders.
  const readmePath = path.join(dest, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    fs.writeFileSync(readmePath, readme.replace(/\{\{PROJECT_NAME\}\}/g, projectName), 'utf8');
  }
  if (localMode) {
    const npmrcPath = path.join(dest, '.npmrc');
    if (fs.existsSync(npmrcPath)) {
      fs.unlinkSync(npmrcPath);
    }
  }
}

// ─── package.json ────────────────────────────────────────────────────────────

const registryScripts = {
  "dev": "concurrently -n proxy,api,admin -c white,cyan,green \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} node proxy.js\" \"PORT=${API_PORT:-4000} fromcode-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} fromcode-admin\"",
  "dev:full": "concurrently -n proxy,api,admin,web -c white,cyan,green,yellow \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} FRONTEND_PORT=${FRONTEND_PORT:-3002} node proxy.js\" \"PORT=${API_PORT:-4000} fromcode-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} fromcode-admin\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} PORT=${FRONTEND_PORT:-3002} fromcode-frontend\"",
  "dev:api": "PORT=${API_PORT:-4000} fromcode-api",
  "start": "concurrently -n proxy,api,admin -c white,cyan,green \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} node proxy.js\" \"NODE_ENV=production PORT=${API_PORT:-4000} fromcode-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} fromcode-admin\"",
  "start:full": "concurrently -n proxy,api,admin,web -c white,cyan,green,yellow \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} FRONTEND_PORT=${FRONTEND_PORT:-3002} node proxy.js\" \"NODE_ENV=production PORT=${API_PORT:-4000} fromcode-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} fromcode-admin\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} PORT=${FRONTEND_PORT:-3002} fromcode-frontend\"",
  "start:api": "NODE_ENV=production PORT=${API_PORT:-4000} fromcode-api",
  "plugin:build": "fromcode plugin build",
  "plugin:dev": "fromcode plugin dev",
  "theme:build": "fromcode theme build",
  "theme:dev": "fromcode theme dev",
  "db:migrate": "fromcode db:migrate",
  "db:reset": "fromcode db:reset",
};

const localScripts = {
  "dev": `concurrently -n proxy,api,admin -c white,cyan,green "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} node proxy.js" "FROMCODE_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run dev --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run dev --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\""`,
  "dev:full": `concurrently -n proxy,api,admin,web -c white,cyan,green,yellow "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} FRONTEND_PORT=\${FRONTEND_PORT:-3002} node proxy.js" "FROMCODE_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run dev --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run dev --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} PORT=\${FRONTEND_PORT:-3002} npm run dev --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/frontend\\""`,
  "dev:api": `FROMCODE_PROJECT_ROOT="$PWD" PORT=\${API_PORT:-4000} npm run dev --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api"`,
  "start": `concurrently -n proxy,api,admin -c white,cyan,green "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} node proxy.js" "FROMCODE_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run start --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run start --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\""`,
  "start:full": `concurrently -n proxy,api,admin,web -c white,cyan,green,yellow "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} FRONTEND_PORT=\${FRONTEND_PORT:-3002} node proxy.js" "FROMCODE_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run start --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run start --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} PORT=\${FRONTEND_PORT:-3002} npm run start --prefix \\"\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/frontend\\""`,
  "start:api": `FROMCODE_PROJECT_ROOT="$PWD" PORT=\${API_PORT:-4000} npm run start --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api"`,
  "plugin:build": `npm run fromcode --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- plugin build`,
  "plugin:dev": `npm run fromcode --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- plugin dev`,
  "theme:build": `npm run fromcode --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- theme build`,
  "theme:dev": `npm run fromcode --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- theme dev`,
  "db:migrate": `npm run fromcode --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- db:migrate`,
  "db:reset": `npm run fromcode --prefix "\${FROMCODE_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- db:reset`,
};

const pkgDeps = localMode
  ? {}
  : {
      "@fromcode119/api": "^0.1.31",
    };

const pkgDevDeps = localMode
  ? {
      "concurrently": "^8.2.2",
      "http-proxy": "^1.18.1",
      "typescript": "^5.3.3",
    }
  : {
      "@fromcode119/cli": "^0.1.31",
      "concurrently": "^8.2.2",
      "http-proxy": "^1.18.1",
      "typescript": "^5.3.3",
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      "@types/node": "^20.11.0",
    };

const devScripts = localMode ? localScripts : registryScripts;

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
  devDependencies: pkgDevDeps,
};

fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// ─── .env (from the shared template) ─────────────────────────────────────────

const envContent = [
  '# Fromcode environment config — edit JWT_SECRET before going live',
  '# See .env.example for all available options',
  '',
  'DB_DIALECT=sqlite',
  localMode
    ? `DATABASE_URL=file:${path.join(dest, 'data', 'app.db')}`
    : 'DATABASE_URL=file:./data/app.db',
  '',
  '# Replace with a real random string before exposing the app',
  'JWT_SECRET=CHANGE_ME_JWT_SECRET_MIN_32_CHARS',
  '',
  'REDIS_URL=',
  '',
  'NEXT_PUBLIC_API_URL=http://localhost:3000',
  'NEXT_PUBLIC_ADMIN_BASE_PATH=/admin',
  'API_URL=http://localhost:4000',
  '',
  'PROXY_PORT=3000',
  'API_PORT=4000',
  'ADMIN_PORT=3001',
  '# FRONTEND_PORT=3002',
  '',
  'NODE_ENV=development',
  localMode
    ? 'MARKETPLACE_URL=off'
    : '# MARKETPLACE_URL=https://marketplace.fromcode.com',
  '',
].join('\n');

fs.writeFileSync(path.join(dest, '.env'), envContent, 'utf8');

if (localMode) {
  const localReadme = [
    `# ${projectName}`,
    '',
    'A Fromcode app wired to your local framework workspace (no npm registry required).',
    '',
    '## Getting started',
    '',
    '```bash',
    '# 1) Install framework workspace deps once',
    `cd ${localWorkspaceRoot}`,
    'npm install',
    '',
    '# 2) Install app helper deps and run',
    `cd ${projectName}`,
    'npm install',
    'npm run dev',
    '```',
    '',
    'Then open http://localhost:3000/admin',
    '',
    'Use full app mode when needed:',
    '',
    '```bash',
    'npm run dev:full',
    '```',
    '',
    'Override the workspace location if needed:',
    '',
    '```bash',
    'FROMCODE_WORKSPACE_ROOT=/absolute/path/to/framework/Source npm run dev',
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dest, 'README.md'), localReadme, 'utf8');
}

// ─── Placeholder dirs ─────────────────────────────────────────────────────────

for (const dir of ['plugins', 'themes', 'data']) {
  fs.mkdirSync(path.join(dest, dir), { recursive: true });
  fs.writeFileSync(path.join(dest, dir, '.gitkeep'), '', 'utf8');
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`  ✓  ${projectName}/package.json`);
console.log(`  ✓  ${projectName}/.env  (edit JWT_SECRET before going live)`);
console.log(`  ✓  ${projectName}/proxy.js`);
if (!localMode) {
  console.log(`  ✓  ${projectName}/.npmrc  (uses GITHUB_TOKEN env var)`);
}
console.log(`  ✓  ${projectName}/plugins/  themes/  data/`);
if (withFrontend) {
  console.log(`  ✓  --frontend: fromcode-frontend included`);
}
console.log('');
console.log('Next steps:');
console.log('');
if (localMode) {
  console.log('  1. Install framework workspace dependencies (once):');
  console.log(`     cd ${localWorkspaceRoot}`);
  console.log('     npm install');
  console.log('');
  console.log(`  2. cd ${projectName}`);
  console.log('  3. npm install');
  console.log('  4. npm run dev');
} else {
  console.log(`  1. cd ${projectName}`);
  console.log('  2. Export a GitHub Packages token (read:packages):');
  console.log('     export GITHUB_TOKEN=<YOUR_GITHUB_TOKEN>');
  console.log('  3. Install and start (extension mode: API + Admin):');
  console.log('     npm install');
  console.log('     npm run dev');
  console.log('');
  console.log('  Optional full app mode (API + Admin + Frontend):');
  console.log('     npm run dev:full');
}
console.log('');
console.log('  Then open: http://localhost:3000/admin');
console.log('');
