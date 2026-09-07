/**
 * A refused ownership change, carrying the answer's HTTP status.
 *
 * The status belongs to the rule that rejected the request, so it is decided where that rule lives. The
 * first version of the controller inferred it by matching the message text — which meant rewording a
 * sentence silently turned a 403 into a 400.
 */
export class PlatformOwnershipError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
