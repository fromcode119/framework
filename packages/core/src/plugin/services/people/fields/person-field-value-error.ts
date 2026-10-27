/** Thrown when a value does not fit its field; `field` is the key, so a client can point at the input. */
export class PersonFieldValueError extends Error {
  constructor(readonly field: string, readonly reason: string) {
    super(`${field}: ${reason}`);
  }
}
