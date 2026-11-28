/** An email ready to send: what a declared template's render method returns. */
export interface IRenderedEmail {
  subject: string;
  html?: string;
  text?: string;
}
