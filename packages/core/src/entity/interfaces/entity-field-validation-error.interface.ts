export interface IEntityFieldValidationError {
  field: string;
  message: string;
  /** Why the field was refused (an `EntityFieldErrorCode` value), so a reader can say it in its own language; `message` is English. */
  code?: string;
}
