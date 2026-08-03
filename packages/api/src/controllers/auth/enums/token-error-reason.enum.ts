import { Enum } from '@fromcode119/reactor';

/** Why a verification/reset token was rejected. */
export class TokenErrorReason extends Enum {
  static readonly INVALID = new TokenErrorReason('invalid');
  static readonly EXPIRED = new TokenErrorReason('expired');

  private constructor(value: string) {
    super(value);
  }
}
