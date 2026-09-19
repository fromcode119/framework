#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

/**
 * The `create-atlantis` bin: scaffolds a new Fromcode project (API, Admin and, by default,
 * Frontend) into a fresh directory.
 *
 * It was a hand-written CommonJS script, which is why nothing checked it: every OOP and typecheck
 * guard filters on `/\.tsx?$/`, so a `.js` entry point is invisible to all of them. It is compiled
 * to `dist/index.js` now, so the source is typed and guarded and only the build output is `.js`.
 */
export class CreateApp {
  /**
   * This package's own root directory, resolved from the compiled file's own location
   * (`dist/index.js` sits one level below the package root the un-compiled `index.js` used to
   * live in, so every path below is resolved from here rather than from `__dirname` directly).
   */
  private static get packageRoot(): string {
    return path.resolve(__dirname, '..');
  }

  private static copyDir(src: string, dst: string): void {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        CreateApp.copyDir(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  private static writeTemplate(dest: string, projectName: string, name: string, content: string): void {
    const filePath = path.join(dest, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content.replace(/\{\{PROJECT_NAME\}\}/g, projectName), 'utf8');
  }

  /** Process entry: scaffold a new project into `./<project-name>`. */
  static run(): void {
    // ─── Argument parsing ────────────────────────────────────────────────────────

    const rawArgs = process.argv.slice(2);
    const localMode = rawArgs.includes('--local');
    const args = rawArgs.filter(a => !a.startsWith('--'));
    const withFrontend = true; // Always include frontend by default
    const workspaceRoot = path.resolve(CreateApp.packageRoot, '..', '..');
    const localWorkspaceRoot = process.env.ATLANTIS_WORKSPACE_ROOT
      ? path.resolve(process.env.ATLANTIS_WORKSPACE_ROOT)
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

    const TEMPLATE_DIR = path.resolve(CreateApp.packageRoot, 'template');

    // ─── File generation ─────────────────────────────────────────────────────────

    console.log(`\nCreating Fromcode project in ./${projectName} ...\n`);

    fs.mkdirSync(dest, { recursive: true });

    // Copy static template files
    if (fs.existsSync(TEMPLATE_DIR)) {
      CreateApp.copyDir(TEMPLATE_DIR, dest);
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

    const registryScripts: Record<string, string> = {
      "dev": "concurrently -n proxy,api,admin -c white,cyan,green \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} node proxy.js\" \"PORT=${API_PORT:-4000} atlantis-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} atlantis-admin\"",
      "dev:full": "concurrently -n proxy,api,admin,web -c white,cyan,green,yellow \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} FRONTEND_PORT=${FRONTEND_PORT:-3002} node proxy.js\" \"PORT=${API_PORT:-4000} atlantis-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} atlantis-admin\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} PORT=${FRONTEND_PORT:-3002} atlantis-frontend\"",
      "dev:api": "PORT=${API_PORT:-4000} atlantis-api",
      "start": "concurrently -n proxy,api,admin -c white,cyan,green \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} node proxy.js\" \"NODE_ENV=production PORT=${API_PORT:-4000} atlantis-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} atlantis-admin\"",
      "start:full": "concurrently -n proxy,api,admin,web -c white,cyan,green,yellow \"PROXY_PORT=${PROXY_PORT:-3000} API_PORT=${API_PORT:-4000} ADMIN_PORT=${ADMIN_PORT:-3001} FRONTEND_PORT=${FRONTEND_PORT:-3002} node proxy.js\" \"NODE_ENV=production PORT=${API_PORT:-4000} atlantis-api\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=${ADMIN_PORT:-3001} atlantis-admin\" \"NEXT_PUBLIC_API_URL=http://localhost:${PROXY_PORT:-3000} PORT=${FRONTEND_PORT:-3002} atlantis-frontend\"",
      "start:api": "NODE_ENV=production PORT=${API_PORT:-4000} atlantis-api",
      "plugin:build": "atlantis plugin build",
      "plugin:dev": "atlantis plugin dev",
      "theme:build": "atlantis theme build",
      "theme:dev": "atlantis theme dev",
      "db:migrate": "atlantis db:migrate",
      "db:reset": "atlantis db:reset",
    };

    const localScripts: Record<string, string> = {
      "dev": `concurrently -n proxy,api,admin -c white,cyan,green "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} node proxy.js" "ATLANTIS_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run dev --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run dev --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\""`,
      "dev:full": `concurrently -n proxy,api,admin,web -c white,cyan,green,yellow "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} FRONTEND_PORT=\${FRONTEND_PORT:-3002} node proxy.js" "ATLANTIS_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run dev --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run dev --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} PORT=\${FRONTEND_PORT:-3002} npm run dev --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/frontend\\""`,
      "dev:api": `ATLANTIS_PROJECT_ROOT="$PWD" PORT=\${API_PORT:-4000} npm run dev --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api"`,
      "start": `concurrently -n proxy,api,admin -c white,cyan,green "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} node proxy.js" "ATLANTIS_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run start --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run start --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\""`,
      "start:full": `concurrently -n proxy,api,admin,web -c white,cyan,green,yellow "PROXY_PORT=\${PROXY_PORT:-3000} API_PORT=\${API_PORT:-4000} ADMIN_PORT=\${ADMIN_PORT:-3001} FRONTEND_PORT=\${FRONTEND_PORT:-3002} node proxy.js" "ATLANTIS_PROJECT_ROOT=\\"$PWD\\" PORT=\${API_PORT:-4000} npm run start --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} NEXT_PUBLIC_ADMIN_BASE_PATH=/admin PORT=\${ADMIN_PORT:-3001} npm run start --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/admin\\"" "NEXT_PUBLIC_API_URL=http://localhost:\${PROXY_PORT:-3000} PORT=\${FRONTEND_PORT:-3002} npm run start --prefix \\"\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/frontend\\""`,
      "start:api": `ATLANTIS_PROJECT_ROOT="$PWD" PORT=\${API_PORT:-4000} npm run start --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}/packages/api"`,
      "plugin:build": `npm run atlantis --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- plugin build`,
      "plugin:dev": `npm run atlantis --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- plugin dev`,
      "theme:build": `npm run atlantis --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- theme build`,
      "theme:dev": `npm run atlantis --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- theme dev`,
      "db:migrate": `npm run atlantis --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- db:migrate`,
      "db:reset": `npm run atlantis --prefix "\${ATLANTIS_WORKSPACE_ROOT:-${localWorkspaceRootEscaped}}" -- db:reset`,
    };

    const pkgDeps: Record<string, string> = localMode
      ? {}
      : {
          "@fromcode119/api": "^0.1.31",
        };

    const pkgDevDeps: Record<string, string> = localMode
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

    const devScripts: Record<string, string | undefined> = localMode ? localScripts : registryScripts;

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
        'ATLANTIS_WORKSPACE_ROOT=/absolute/path/to/framework/Source npm run dev',
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
      console.log(`  ✓  --frontend: atlantis-frontend included`);
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
  }
}

CreateApp.run();
