/** What an image itself declares, so a recreated container takes the NEW image's defaults, not the old one's. */
export interface IImageDefaults {
  Env: string[];
  Cmd: string[] | null;
  Entrypoint: string[] | null;
  WorkingDir: string;
}
