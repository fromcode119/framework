import { SecretService } from '@core/security/secret-service';

/**
 * Moves the secrets inside a stored value from one key to another.
 *
 * A secret is encrypted with the key of the deployment that holds it, so an archive carries
 * credentials that arrive intact and unreadable: the integration then behaves exactly as if it had
 * never been configured, which is the failure this exists to end. Resealing under a passphrase both
 * deployments know lets the credential travel with the data — the archive still holds only
 * ciphertext, and the passphrase travels separately, so neither alone is enough.
 *
 * Secrets are found by their OWN marker, never by guessing at key names: a settings row keeps them
 * nested in JSON, and a name pattern would miss whatever the next plugin calls its credential.
 *
 * Plaintext exists only between the two calls inside one process, and is never returned, logged or
 * written: `sealForTransit` opens with the deployment's key and closes with the passphrase;
 * `openFromTransit` does the reverse.
 */
export class SecretTransitResealer {
  /** Deployment key → transit passphrase, for a value about to be written into an archive. */
  static sealForTransit(value: unknown, passphrase: string): unknown {
    return SecretTransitResealer.walk(value, (secret) => SecretService.encryptWith(SecretService.decrypt(secret), passphrase));
  }

  /** Transit passphrase → this deployment's key, for a value read out of an archive. */
  static openFromTransit(value: unknown, passphrase: string): unknown {
    return SecretTransitResealer.walk(value, (secret) => SecretService.encrypt(SecretService.decryptWith(secret, passphrase)));
  }

  /** How many secrets a value carries — for reporting a count without ever naming or showing one. */
  static count(value: unknown): number {
    let found = 0;
    SecretTransitResealer.walk(value, (secret) => {
      found += 1;
      return secret;
    });
    return found;
  }

  private static walk(value: unknown, reseal: (secret: string) => string): unknown {
    if (typeof value === 'string') {
      if (SecretService.isEncryptedValue(value)) return reseal(value);
      if (!SecretService.carriesEncryptedValue(value)) return value;
      // A settings row arrives as JSON held in a text column; its secrets are leaves inside it.
      try {
        return JSON.stringify(SecretTransitResealer.walk(JSON.parse(value), reseal));
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) return value.map((entry) => SecretTransitResealer.walk(entry, reseal));
    if (value && typeof value === 'object') {
      const walked: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        walked[key] = SecretTransitResealer.walk(entry, reseal);
      }
      return walked;
    }
    return value;
  }
}
