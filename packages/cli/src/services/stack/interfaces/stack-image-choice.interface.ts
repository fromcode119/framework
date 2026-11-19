/** The image tag a stack will run on, and the reason when it is not the one preferred. */
export interface IStackImageChoice {
  readonly tag: string;
  readonly note: string | null;
}
