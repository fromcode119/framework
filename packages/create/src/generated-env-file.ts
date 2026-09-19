import path from 'node:path';

/**
 * The `.env` a newly scaffolded project starts with.
 *
 * Split out of `create-app.ts` to keep that file under the 300-line limit, and the division is a
 * real one: this is the CONTENT a generated project receives, while `create-app` is the procedure
 * that writes it.
 *
 * Every value here is one a new project can run with immediately — SQLite rather than a database
 * server, an in-process cache rather than Redis — so `npm run dev` works before anything is
 * configured. The two that are not safe defaults say so on the line above them: `JWT_SECRET` is a
 * placeholder that must be replaced, and the local-mode marketplace is switched off rather than
 * pointed at a host a local checkout cannot reach.
 */
export class GeneratedEnvFile {
  /**
   * `localMode` writes an ABSOLUTE database path.
   *
   * A generated project in local mode is run through `npm --prefix` from the framework workspace,
   * so its cwd is not its own directory and a relative `file:./data/app.db` would resolve against
   * the wrong root.
   */
  static contents(dest: string, localMode: boolean): string {
    return [
      '# Atlantis environment config — edit JWT_SECRET before going live',
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
  }
}
