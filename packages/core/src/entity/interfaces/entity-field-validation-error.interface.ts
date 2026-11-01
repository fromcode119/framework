export interface IEntityFieldValidationError {
  field: string;
  message: string;
  /** Why the field was refused (an `EntityFieldErrorCode` value), so a reader can say it in its own language; `message` is English. */
  code?: string;
  /** The values the refusal names (a minimum, a maximum), for the reader's own sentence. */
  vars?: Record<string, string | number>;
}
