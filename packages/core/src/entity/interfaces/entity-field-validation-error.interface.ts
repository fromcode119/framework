export interface IEntityFieldValidationError {
  field: string;
  message: string;
  /** Why the field was refused, so a reader can say it in its own language (`message` is English). */
  code?: 'required';
}
