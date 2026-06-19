import { Command } from 'commander';
import chalk from 'chalk';
import * as bcrypt from 'bcryptjs';
import { SystemConstants } from '@fromcode119/core';
import { CliUtils } from '../utils';

/**
 * Offline account-recovery commands. These talk DIRECTLY to the database (via DATABASE_URL),
 * never through the running API — so they work even when the admin UI is locked out (broken
 * login, no admin user, lost password). Password hashing matches AuthManager.hashPassword
 * (bcrypt, 12 rounds), so a reset done here is immediately valid for login.
 */
export class AuthRecoveryCommandService {
  private static readonly BCRYPT_ROUNDS = 12;
  private static readonly ADMIN_ROLE = 'admin';
  private static readonly USERS_TABLE = SystemConstants.TABLE.USERS;

  static register(program: Command): void {
    const auth = program.command('auth').description('Account recovery (offline, direct DB)');

    auth
      .command('list')
      .description('List all users with their roles')
      .action(async () => {
        await AuthRecoveryCommandService.listUsers();
      });

    auth
      .command('set-password <email> <password>')
      .description('Set a user\'s password (bcrypt) — recover a locked-out account')
      .action(async (email: string, password: string) => {
        await AuthRecoveryCommandService.setPassword(email, password);
      });

    auth
      .command('grant-admin <email>')
      .description('Add the "admin" role to an existing user')
      .action(async (email: string) => {
        await AuthRecoveryCommandService.grantAdmin(email);
      });

    auth
      .command('create-admin <email> <password>')
      .description('Create a new admin user')
      .action(async (email: string, password: string) => {
        await AuthRecoveryCommandService.createAdmin(email, password);
      });
  }

  private static normalizeEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
  }

  private static parseRoles(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map((r) => String(r));
    try {
      const parsed = JSON.parse(String(raw || '[]'));
      return Array.isArray(parsed) ? parsed.map((r) => String(r)) : [];
    } catch {
      return [];
    }
  }

  private static async listUsers(): Promise<void> {
    const db = await CliUtils.getDatabase();
    try {
      const rows = await db.find(AuthRecoveryCommandService.USERS_TABLE, { orderBy: { id: 'asc' }, limit: 1000 });
      console.log(chalk.white(`\n${rows.length} user(s):`));
      console.log(chalk.gray('--------------------------------------------------'));
      for (const row of rows) {
        const roles = AuthRecoveryCommandService.parseRoles(row.roles);
        const email = row.email || chalk.gray('(no email)');
        console.log(`${chalk.bold(String(row.id).padStart(3))}  ${chalk.cyan(email)}  ${chalk.gray('roles:')} ${roles.join(', ') || chalk.gray('none')}`);
      }
      console.log('');
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to list users:'), error.message);
      process.exit(1);
    }
  }

  private static async setPassword(emailInput: string, password: string): Promise<void> {
    const email = AuthRecoveryCommandService.normalizeEmail(emailInput);
    if (!password || password.length < 8) {
      console.error(chalk.red('Password must be at least 8 characters.'));
      process.exit(1);
    }
    const db = await CliUtils.getDatabase();
    try {
      const user = await db.findOne(AuthRecoveryCommandService.USERS_TABLE, { email });
      if (!user) {
        console.error(chalk.red(`No user found with email: ${email}`));
        console.error(chalk.gray('Use "fromcode auth list" to see existing users, or "auth create-admin".'));
        process.exit(1);
      }
      const hash = await bcrypt.hash(password, AuthRecoveryCommandService.BCRYPT_ROUNDS);
      await db.update(AuthRecoveryCommandService.USERS_TABLE, { email }, { password: hash, updatedAt: new Date().toISOString() });
      console.log(chalk.green(`✔ Password updated for ${chalk.bold(email)}. You can log in now.`));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to set password:'), error.message);
      process.exit(1);
    }
  }

  private static async grantAdmin(emailInput: string): Promise<void> {
    const email = AuthRecoveryCommandService.normalizeEmail(emailInput);
    const db = await CliUtils.getDatabase();
    try {
      const user = await db.findOne(AuthRecoveryCommandService.USERS_TABLE, { email });
      if (!user) {
        console.error(chalk.red(`No user found with email: ${email}`));
        process.exit(1);
      }
      const roles = AuthRecoveryCommandService.parseRoles(user.roles);
      if (roles.includes(AuthRecoveryCommandService.ADMIN_ROLE)) {
        console.log(chalk.yellow(`${email} already has the "admin" role.`));
        process.exit(0);
      }
      roles.push(AuthRecoveryCommandService.ADMIN_ROLE);
      await db.update(
        AuthRecoveryCommandService.USERS_TABLE,
        { email },
        { roles: JSON.stringify(roles), updatedAt: new Date().toISOString() },
      );
      console.log(chalk.green(`✔ Granted "admin" to ${chalk.bold(email)} (roles: ${roles.join(', ')}).`));
      console.log(chalk.gray('Existing sessions must re-login for the new role to take effect.'));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to grant admin:'), error.message);
      process.exit(1);
    }
  }

  private static async createAdmin(emailInput: string, password: string): Promise<void> {
    const email = AuthRecoveryCommandService.normalizeEmail(emailInput);
    if (!email || !email.includes('@')) {
      console.error(chalk.red('A valid email is required.'));
      process.exit(1);
    }
    if (!password || password.length < 8) {
      console.error(chalk.red('Password must be at least 8 characters.'));
      process.exit(1);
    }
    const db = await CliUtils.getDatabase();
    try {
      const existing = await db.findOne(AuthRecoveryCommandService.USERS_TABLE, { email });
      if (existing) {
        console.error(chalk.red(`A user with ${email} already exists. Use "auth set-password" / "auth grant-admin" instead.`));
        process.exit(1);
      }
      const now = new Date().toISOString();
      const hash = await bcrypt.hash(password, AuthRecoveryCommandService.BCRYPT_ROUNDS);
      await db.insert(AuthRecoveryCommandService.USERS_TABLE, {
        email,
        password: hash,
        roles: JSON.stringify([AuthRecoveryCommandService.ADMIN_ROLE]),
        permissions: JSON.stringify([]),
        createdAt: now,
        updatedAt: now,
      });
      console.log(chalk.green(`✔ Created admin user ${chalk.bold(email)}. You can log in now.`));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to create admin:'), error.message);
      process.exit(1);
    }
  }
}
