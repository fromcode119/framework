import type { ISetupAccountErrors } from '@/app/setup/setup-account-errors.interface';

/**
 * The only two account faults a browser can judge on its own: an empty field, and two passwords that
 * differ. Password STRENGTH belongs to the API, which holds the policy — a second rule here would
 * eventually disagree with it, and the old form's "min 6 characters" already did.
 */
export class SetupAccountValidation {
  static check(
    values: { email: string; password: string; confirmPassword: string },
    messages: { required: string; mismatch: string },
  ): ISetupAccountErrors {
    const errors: ISetupAccountErrors = {};
    if (!values.email) errors.email = messages.required;
    if (!values.password) errors.password = messages.required;
    if (!values.confirmPassword) errors.confirmPassword = messages.required;
    if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
      errors.confirmPassword = messages.mismatch;
    }
    return errors;
  }
}
