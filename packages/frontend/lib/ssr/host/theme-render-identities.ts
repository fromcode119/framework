import { SystemConstants } from '@fromcode119/core/client';

/**
 * Which OS user each resident render host runs as: its OWN, one per generation signature.
 *
 * Every host used to run as the one theme uid, so a host was the same user as every other: it could
 * signal them, and walk into their spawner directories, whose only guard is that another user cannot.
 * Each host now takes a uid of its own from the theme range (the one the egress rule already denies),
 * kept for its signature while it is resident and handed out round-robin, so a uid freed by an evicted
 * host is the last to be reused while that process is still exiting.
 */
export class ThemeRenderIdentities {
  /** The theme range is THEME_UID … THEME_UID + SIZE - 1 (21000–21999), inside the guest range. */
  static readonly SIZE = 1000;

  private static readonly bySignature = new Map<string, number>();
  private static next = 0;

  static uidFor(signature: string): number {
    const held = ThemeRenderIdentities.bySignature.get(signature);
    if (held !== undefined) return held;
    const taken = new Set(ThemeRenderIdentities.bySignature.values());
    for (let tried = 0; tried < ThemeRenderIdentities.SIZE; tried += 1) {
      const uid = SystemConstants.PROCESS_ISOLATION.THEME_UID + ThemeRenderIdentities.next;
      ThemeRenderIdentities.next = (ThemeRenderIdentities.next + 1) % ThemeRenderIdentities.SIZE;
      if (taken.has(uid)) continue;
      ThemeRenderIdentities.bySignature.set(signature, uid);
      return uid;
    }
    throw new Error(`No free render-host uid: ${ThemeRenderIdentities.SIZE} hosts are resident.`);
  }

  static release(signature: string): void {
    ThemeRenderIdentities.bySignature.delete(signature);
  }
}
