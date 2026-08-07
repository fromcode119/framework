import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { SecretService } from '@core/security/secret-service';
import type { IPluginContextMeta } from '@core/interfaces/plugin-context-meta.interface';

/**
 * The platform's ONE signing secret, owned by the framework.
 *
 * Why this exists: every plugin that hands a guest a capability link (an appointment "manage your
 * booking" token, a newsletter unsubscribe token, a share link) needs an HMAC key. Left to itself each
 * plugin invented its own — and both `appointments` and `subscriptions` shipped a code-literal
 * `|| 'default-secret-change-me'` fallback, so the key was PUBLISHED IN THE SOURCE and anyone could
 * forge a token for anybody's record. A signing key is not a setting an operator should be asked to
 * invent, and it must never have a literal in code, so it is a framework capability instead.
 *
 * Contract:
 * - ONE per-install ROOT secret, 32 cryptographically-random bytes, generated on FIRST USE and stored
 *   in `_system_meta` (encrypted at rest whenever `SECRET_KEY` is configured — see {@link SecretService}).
 * - Callers never see the root. {@link signingKey} returns a key DERIVED for one named purpose, so a
 *   token minted for `subscriptions.unsubscribe` can never be replayed against
 *   `appointments.manage-booking`, and a leak of one purpose key does not expose the others.
 * - It FAILS CLOSED. If the root cannot be read or persisted, every method throws
 *   {@link SigningSecretService.UNAVAILABLE}; there is no default, no fallback, no "sign anyway".
 * - The value is never exposed to an admin client: the key is deliberately NOT one of
 *   `SystemConstants.META_KEY`, so `SystemSettingsExposureUtils` will not return it. {@link status}
 *   is the operator-visible surface — it reports THAT a key exists and when it was created, never the
 *   key — and {@link rotate} replaces it.
 *
 * Rotation invalidates every capability link already mailed out. That is the point of rotating; it is
 * also why rotation must be an explicit operator action and never something the framework does on its own.
 */
export class SigningSecretService {
  /** Thrown (as an Error message) whenever a signing key cannot be resolved. Callers must fail closed. */
  static readonly UNAVAILABLE = 'SIGNING_SECRET_UNAVAILABLE';

  /**
   * `_system_meta` keys. Colon-namespaced like the other machine secrets in that table
   * (`user:<id>:totp_secret`, `scim:token`) and deliberately absent from `SystemConstants.META_KEY`
   * so the settings-exposure allow-list can never hand them to a client.
   */
  private static readonly ROOT_META_KEY = 'system:signing_secret';
  private static readonly CREATED_AT_META_KEY = 'system:signing_secret_created_at';

  /** Domain separator, versioned so a future KDF change cannot silently validate old signatures. */
  private static readonly DERIVATION_LABEL = 'fromcode.signing.v1';

  private static readonly ROOT_BYTES = 32;

  /**
   * The HMAC key for one named `purpose` (e.g. `'appointments.manage-booking'`). Generates the
   * install's root secret the first time anything asks for a key.
   *
   * @throws when `purpose` is blank or the root cannot be resolved — never returns a fallback.
   */
  static async signingKey(meta: IPluginContextMeta, purpose: string): Promise<string> {
    const normalizedPurpose = String(purpose ?? '').trim();
    if (!normalizedPurpose) {
      throw new Error(`${SigningSecretService.UNAVAILABLE}: a signing purpose is required`);
    }

    const root = await SigningSecretService.resolveRoot(meta);
    return createHmac('sha256', root)
      .update(`${SigningSecretService.DERIVATION_LABEL}|${normalizedPurpose}`)
      .digest('hex');
  }

  /** Hex HMAC-SHA256 of `message` under `key`. Throws when the key is empty — no unsigned tokens. */
  static sign(key: string, message: string): string {
    const normalizedKey = String(key ?? '');
    if (!normalizedKey) {
      throw new Error(`${SigningSecretService.UNAVAILABLE}: refusing to sign without a key`);
    }
    return createHmac('sha256', normalizedKey).update(String(message ?? '')).digest('hex');
  }

  /**
   * Constant-time signature check. Returns false (never throws) for a missing key, a missing
   * signature or a length mismatch, so a caller can treat "cannot verify" and "does not match"
   * identically — both mean reject.
   */
  static verify(key: string, message: string, signature: string): boolean {
    const normalizedKey = String(key ?? '');
    const provided = String(signature ?? '');
    if (!normalizedKey || !provided) return false;

    const expected = createHmac('sha256', normalizedKey).update(String(message ?? '')).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  /**
   * Operator-visible state of the install's signing key: whether one exists and when it was created.
   * NEVER returns the secret itself — this is what an admin "Security" panel renders so the operator
   * can see the source of every capability link the platform issues.
   */
  static async status(meta: IPluginContextMeta): Promise<{ configured: boolean; createdAt: string | null }> {
    const stored = await meta.get(SigningSecretService.ROOT_META_KEY);
    const createdAt = await meta.get(SigningSecretService.CREATED_AT_META_KEY);
    return {
      configured: !!String(stored ?? '').trim(),
      createdAt: String(createdAt ?? '').trim() || null,
    };
  }

  /**
   * Replace the install's root secret with a fresh one and report when it happened.
   *
   * OPERATOR IMPACT: every capability link already issued against the old root — booking manage
   * links, unsubscribe links in already-delivered email — stops validating immediately. Recipients
   * see "invalid link" and have to be re-sent one. Keeping the old key as a fallback would defeat
   * the rotation entirely, so there is deliberately no grace period.
   */
  static async rotate(meta: IPluginContextMeta): Promise<{ createdAt: string }> {
    const createdAt = new Date().toISOString();
    await SigningSecretService.persistRoot(meta, randomBytes(SigningSecretService.ROOT_BYTES).toString('hex'), createdAt);
    return { createdAt };
  }

  /** Read the root, generating and persisting one on first use. Throws rather than returning a default. */
  private static async resolveRoot(meta: IPluginContextMeta): Promise<string> {
    const existing = await SigningSecretService.readStoredRoot(meta);
    if (existing) return existing;

    // First use on this install. Two boots can race here; both write, the last write wins, and the
    // re-read below means every caller ends up on whichever root actually landed in the row.
    await SigningSecretService.persistRoot(
      meta,
      randomBytes(SigningSecretService.ROOT_BYTES).toString('hex'),
      new Date().toISOString(),
    );

    const created = await SigningSecretService.readStoredRoot(meta);
    if (!created) {
      throw new Error(`${SigningSecretService.UNAVAILABLE}: could not persist the platform signing secret`);
    }
    return created;
  }

  private static async readStoredRoot(meta: IPluginContextMeta): Promise<string> {
    const stored = String((await meta.get(SigningSecretService.ROOT_META_KEY)) ?? '').trim();
    if (!stored) return '';
    // `decrypt` passes a plaintext value straight through, so this covers both storage modes.
    return String(SecretService.decrypt(stored) ?? '').trim();
  }

  /**
   * Store the root, encrypted whenever the server has a `SECRET_KEY`. Without one `SecretService`
   * refuses to encrypt; the root is then stored as-is, which is the same trust level the platform
   * already assigns its database in that configuration.
   */
  private static async persistRoot(meta: IPluginContextMeta, root: string, createdAt: string): Promise<void> {
    let stored = root;
    try {
      stored = SecretService.encrypt(root);
    } catch {
      stored = root;
    }
    await meta.set(SigningSecretService.ROOT_META_KEY, stored);
    await meta.set(SigningSecretService.CREATED_AT_META_KEY, createdAt);
  }
}
