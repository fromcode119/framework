import { Enum } from '@fromcode119/react-class-components';

/** Which challenge type an order answers with. DNS-01 is the only way to prove a wildcard name. */
export class AcmeChallengeType extends Enum {
  static readonly HTTP_01 = new AcmeChallengeType('http-01');
  static readonly DNS_01 = new AcmeChallengeType('dns-01');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to HTTP_01 — the pre-existing behaviour when nothing is set. */
  static resolve(value: unknown): AcmeChallengeType {
    if (value instanceof AcmeChallengeType) return value;
    const found = AcmeChallengeType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as AcmeChallengeType | undefined) ?? AcmeChallengeType.HTTP_01;
  }
}
