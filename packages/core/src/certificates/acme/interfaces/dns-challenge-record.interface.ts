/**
 * A DNS-01 challenge record a {@link IDnsChallengeProvider} created, kept only long enough to hand
 * back to that same provider for removal. Deliberately a marker with no shape of its own — each
 * provider's own record type (e.g. `CloudflareChallengeRecord`'s `zoneId`/`recordId`) satisfies this
 * structurally, and `AcmeClientAdapter` never reads a field off it, only stores and forwards it.
 */
export interface IDnsChallengeRecord {}
