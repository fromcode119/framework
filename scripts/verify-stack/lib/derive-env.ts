/**
 * Derives the verify stack's env files from the framework project's RESOLVED compose config.
 *
 *   tsx derive-env.ts <framework-config.json> <out-dir> <apiOrigin> <frontendOrigin>
 *
 * Reads only; writes `<out-dir>/api.env`, `frontend.env` and `admin.env`. Every `*.framework.local`
 * URL is rewritten to the loopback origins, the database becomes this stack's own, redis its own
 * service, cookies host-only, CORS the loopback hosts. NOTHING ELSE IS INVENTED: a key the framework
 * config does not carry is not added here, except the rewrites listed in the overrides below.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

class DeriveEnv {
  private static readonly SERVICES = ['api', 'frontend', 'admin'] as const;

  /** The stack's own addresses replace the shared project's hostnames, everywhere they appear. */
  private static rewriteUrls(value: unknown, apiOrigin: string, frontendOrigin: string, adminOrigin: string): string {
    return String(value)
      .replace(/https?:\/\/api\.framework\.local/g, apiOrigin)
      .replace(/https?:\/\/frontend\.framework\.local/g, frontendOrigin)
      .replace(/https?:\/\/admin\.framework\.local/g, adminOrigin);
  }

  private static overrides(apiOrigin: string, frontendOrigin: string, adminOrigin: string): Record<string, Record<string, string>> {
    return {
      api: {
        // POSTGRES, matching what is deployed. Three logins against this stack's OWN database container:
        //   bootstrap = superuser, spent once per boot by the entrypoint to create the other two;
        //   migration = schema owner, runs migrations;
        //   app       = NON-owner, NON-superuser — the only role row-level security applies to. Connecting
        //               as the owner or a superuser bypasses every policy silently, so tenancy would look
        //               healthy while isolating nothing.
        // SQLite is deliberately NOT used: it has no tenant isolation strategy, so the api refuses to boot
        // with any tenant row and the stack could only ever prove the single-tenant path.
        // The entrypoint switches on DEPLOYMENT_MODE, and `db bootstrap-roles` — which CREATES the owner and
        // app logins — only runs under api|api-admin|full. It is set on the shared stack's service
        // definition rather than in its environment, so deriving the env alone loses it and the api boots
        // straight into "password authentication failed for user fcverify_owner".
        DEPLOYMENT_MODE: 'api',
        DATABASE_BOOTSTRAP_URL: 'postgresql://fcverify:fcverify_local_only@db:5432/fcverify',
        DATABASE_MIGRATION_URL: 'postgresql://fcverify_owner:fcverify_owner_local@db:5432/fcverify',
        DATABASE_URL: 'postgresql://fcverify_app:fcverify_app_local@db:5432/fcverify',
        DB_DIALECT: 'postgres',
        REDIS_URL: 'redis://redis:6379',
        CORS_ALLOWED_DOMAINS: '127.0.0.1,localhost',
        COOKIE_DOMAIN: '',
        STORAGE_PUBLIC_URL: `${apiOrigin}/uploads`,
        NEXT_PUBLIC_API_URL: apiOrigin,
        INTERNAL_FRONTEND_URL: 'http://frontend:3000',
        INTERNAL_ADMIN_URL: 'http://admin:3000',
      },
      frontend: {
        API_URL: 'http://api:3000',
        NEXT_PUBLIC_API_URL: apiOrigin,
        FRONTEND_URL: frontendOrigin,
        // Islands rollout flag for THIS stack only (VERIFY_ISLANDS=1 on the host): the frontend serves content
        // paths as static documents + the runtime script. Off = today's App Router path.
        STOREFRONT_DOCUMENT_ISLANDS: process.env.VERIFY_ISLANDS === '1' ? '1' : '',
      },
      admin: {
        API_URL: 'http://api:3000',
        NEXT_PUBLIC_API_URL: apiOrigin,
        ADMIN_URL: adminOrigin,
        FRONTEND_URL: frontendOrigin,
      },
    };
  }

  private static toEnvFile(env: Record<string, string>): string {
    return `${Object.entries(env)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`;
  }

  static main(argv: string[]): number {
    const [configPath, outDir, apiOrigin, frontendOrigin] = argv;
    if (!configPath || !outDir || !apiOrigin || !frontendOrigin) {
      console.error('usage: derive-env <config.json> <out-dir> <apiOrigin> <frontendOrigin>');
      return 2;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const adminOrigin = process.env.VERIFY_ADMIN_ORIGIN || 'http://127.0.0.1:3997';
    const overrides = DeriveEnv.overrides(apiOrigin, frontendOrigin, adminOrigin);

    mkdirSync(outDir, { recursive: true });

    for (const service of DeriveEnv.SERVICES) {
      const source = config.services?.[service]?.environment;
      if (!source || typeof source !== 'object') throw new Error(`framework config has no environment for ${service}`);

      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(source)) {
        env[key] = value == null ? '' : DeriveEnv.rewriteUrls(value, apiOrigin, frontendOrigin, adminOrigin);
      }
      Object.assign(env, overrides[service]);

      writeFileSync(join(outDir, `${service}.env`), DeriveEnv.toEnvFile(env));

      const rewritten = Object.keys(source).filter((key) => String(source[key] ?? '').includes('framework.local'));
      console.log(`${service}.env: ${Object.keys(env).length} keys; url-rewritten: ${rewritten.join(', ') || '-'}; overridden: ${Object.keys(overrides[service]!).join(', ')}`);
    }

    return 0;
  }
}

process.exit(DeriveEnv.main(process.argv.slice(2)));
