import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';

/**
 * The secrets a deployment needs before it can start, generated once if nobody supplied them.
 *
 * These are the three an operator was asked to invent by hand: the JWT signing secret, the key the
 * settings store is encrypted with, and the shared secret the gateway authenticates to the api with.
 * Asking a person to type 32 random characters into a file before anything will start is the step
 * that ends an installation, and what they invent is usually worse than what a CSPRNG would.
 *
 * ENV ALWAYS WINS. A deployment that sets these keeps using exactly what it set, so nothing changes
 * on upgrade and an operator who manages secrets elsewhere is never second-guessed. Generation only
 * happens for a key nobody supplied.
 *
 * GENERATED ONCE, THEN NEVER AGAIN. They are written to the deployment's own data directory, which
 * is mounted in every topology precisely so its contents survive an image upgrade. Regenerating any
 * of them is not a small thing: a new JWT secret signs every existing session out, and a new
 * integration key makes every stored credential — SMTP passwords, payment keys — permanently
 * undecryptable. So the file is read before anything is created, written atomically, and never
 * rewritten for a key it already holds.
 */
export class BootstrapSecretsService {
  /** `SECRET_KEY` is the older name for the integration key; either one counts as supplied. */
  private static readonly ALIASES: Record<string, readonly string[]> = {
    INTEGRATION_SECRET_KEY: ['SECRET_KEY'],
  };

  private static readonly KEYS = ['JWT_SECRET', 'INTEGRATION_SECRET_KEY', 'INTERNAL_SERVICE_SECRET'] as const;
  private static readonly FILE_NAME = 'secrets.json';
  /** 64 hex characters — comfortably past the 32-character minimum production already enforces. */
  private static readonly BYTES = 32;

  /**
   * Fill in any secret the environment did not supply, and return which ones had to be created.
   *
   * Call this BEFORE anything reads a secret — before the production assertions, before the auth
   * manager, before the settings store is opened.
   */
  static ensure(): { generated: string[]; file: string } {
    const file = path.join(ProjectPaths.getDataDir(), BootstrapSecretsService.FILE_NAME);
    const stored = BootstrapSecretsService.read(file);
    const generated: string[] = [];

    for (const key of BootstrapSecretsService.KEYS) {
      if (BootstrapSecretsService.suppliedByEnvironment(key)) continue;

      const existing = String(stored[key] || '').trim();
      if (existing) {
        process.env[key] = existing;
        continue;
      }

      const value = crypto.randomBytes(BootstrapSecretsService.BYTES).toString('hex');
      stored[key] = value;
      process.env[key] = value;
      generated.push(key);
    }

    if (generated.length) BootstrapSecretsService.write(file, stored);
    return { generated, file };
  }

  private static suppliedByEnvironment(key: string): boolean {
    const names = [key, ...(BootstrapSecretsService.ALIASES[key] || [])];
    return names.some((name) => String(process.env[name] || '').trim().length > 0);
  }

  /** A file that cannot be read is treated as absent — never as a reason to refuse to start. */
  private static read(file: string): Record<string, string> {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
    } catch {
      return {};
    }
  }

  /**
   * Written through a temporary file and renamed, so a crash mid-write cannot leave a truncated file
   * that the next boot would read as "no secret" and regenerate over.
   */
  private static write(file: string, secrets: Record<string, string>): void {
    const directory = path.dirname(file);
    fs.mkdirSync(directory, { recursive: true });

    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
    // `mode` on write only applies when the file is created, so it is set again for the final name.
    fs.chmodSync(file, 0o600);
  }
}
