import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The sign-up email rows of {@link SystemSettingDescriptors} — edited per site in Settings → General.
 * Each copy row is SEEDED with the framework's default text, so a site sees and edits the real words
 * rather than an empty box that silently means something. `{{brandName}}` (the Platform Name),
 * `{{firstNameSuffix}}` (", Ann" or nothing) and `{{year}}` are filled in when the email is sent.
 */
export class SignupEmailSettingDescriptors {
  private static copy(value: string, description: string) {
    return { scope: SettingScope.SITE, writable: true, exposed: true, seed: { value, description, group: 'Sign-up email' } };
  }

  static readonly ALL = {
    [SystemConstants.META_KEY.SIGNUP_EMAIL_BRANDED]: SignupEmailSettingDescriptors.copy('false', 'Send the branded sign-up email built from the copy below instead of the plain one.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_SUBJECT]: SignupEmailSettingDescriptors.copy('{{brandName}}: Verify your email', 'Subject of the branded sign-up email.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_GREETING]: SignupEmailSettingDescriptors.copy('Hello{{firstNameSuffix}}', 'Greeting line above the heading.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_TITLE]: SignupEmailSettingDescriptors.copy('Verify your email address', 'Heading of the branded sign-up email.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_MESSAGE]: SignupEmailSettingDescriptors.copy('One more step and your {{brandName}} account is active.', 'Message under the heading.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_BUTTON_LABEL]: SignupEmailSettingDescriptors.copy('Verify email', 'Label of the verify button.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_FALLBACK_LABEL]: SignupEmailSettingDescriptors.copy('If the button does not work, copy this address into your browser:', 'Line above the plain verification link.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_IGNORE_MESSAGE]: SignupEmailSettingDescriptors.copy('If you did not create this account, you can safely ignore this email.', 'Closing line for someone who did not sign up.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_FOOTER_TEXT]: SignupEmailSettingDescriptors.copy('© {{year}} {{brandName}}. All rights reserved.', 'Small print at the bottom.'),
    [SystemConstants.META_KEY.SIGNUP_EMAIL_ACCENT_COLOR]: SignupEmailSettingDescriptors.copy('#5b2a9f', 'Colour of the verify button and link.'),
  };
}
