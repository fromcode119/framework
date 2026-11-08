/** One stream a person can switch off, as the preferences API describes it. */
export interface IAlertPreference {
  key: string;
  /** Worded by the sender's own dictionary on the server; empty when only the console's can word it. */
  label: string;
  description: string;
  labelKey: string;
  descriptionKey: string;
  /** Shown with its switch held on: an alert whose silence would leave the site unwatched. */
  locked: boolean;
  subscribed: boolean;
}
