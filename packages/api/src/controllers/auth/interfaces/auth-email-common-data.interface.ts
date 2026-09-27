/** What every framework email template receives, whatever else its sender adds. */
export interface IAuthEmailCommonData {
  /** The site's name as the platform signs its mail. */
  appName: string;
  /** The person the email is about. `firstName` is empty when unknown — the template decides the greeting. */
  user: { firstName: string; email: string };
  /** The active theme's variables for the site (contact email, social links, …). */
  theme: Record<string, unknown>;
  /** The reader's language — which template folder is read, and what the template may print. */
  locale: string;
}
