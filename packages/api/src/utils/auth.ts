import { createHash } from 'crypto';

/**
 * Normalizes an email address by trimming and lowercasing.
 */
export class AuthUtils {

      /**
       * Basic email validation regex.
       */
      static normalizeEmail(email: any): string {
            return String(email || '').trim().toLowerCase();

      }

      static isValidEmail(email: string): boolean {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      }

      /**
       * Hashes a token using SHA-256.
       */
      static hashToken(token: string): string {
            return createHash('sha256').update(String(token || '').trim()).digest('hex');

      }

      /**
       * Hashes a recovery or short code using SHA-256 (uppercased).
       */
      static hashRecoveryCode(code: string): string {
            return createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');

      }

      /**
       * Parses a string/JSON roles field into an array of strings.
       */
      static parseRoles(roles: any): string[] {
            if (!roles) return [];
            if (Array.isArray(roles)) return roles.map((role: any) => String(role));
            if (typeof roles === 'string') {
                  try {
                        const parsed = JSON.parse(roles);
                        if (Array.isArray(parsed)) return parsed.map((role) => String(role));
                  } catch { }
            }
            return [];

      }

      /**
       * Parses a user ID into an integer.
       */
      static parseUserId(raw: any): number {
            const parsed = Number.parseInt(String(raw || ''), 10);
            if (Number.isNaN(parsed) || parsed <= 0) return 0;
            return parsed;

      }
}