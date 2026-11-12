/** What the sign-in's side column says at one step: a heading and either a line of text or a short list. */
export interface ILoginHelp {
  title: string;
  text?: string;
  items?: string[];
}
