export interface IValidatorFunction {
  (data: any): boolean | Promise<boolean>;
}