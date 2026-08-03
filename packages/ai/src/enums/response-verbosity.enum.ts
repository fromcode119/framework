import { Enum } from '@fromcode119/reactor';

/** How verbose an assistant response should be. */
export class ResponseVerbosity extends Enum {
  static readonly CONCISE = new ResponseVerbosity('concise');
  static readonly DETAILED = new ResponseVerbosity('detailed');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to CONCISE. */
  static resolve(value: unknown): ResponseVerbosity {
    if (value instanceof ResponseVerbosity) return value;
    const found = ResponseVerbosity.fromValue(String(value ?? '').trim());
    return (found as unknown as ResponseVerbosity | undefined) ?? ResponseVerbosity.CONCISE;
  }
}
