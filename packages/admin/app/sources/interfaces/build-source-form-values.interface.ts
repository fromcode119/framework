export interface IBuildSourceFormValues {
  autoBuild: boolean;
  autoUpdate: boolean;
  branch: string;
  gitSecret: string;
  gitUrl: string;
  slug: string;
  type: 'plugin' | 'theme' | 'core';
}
