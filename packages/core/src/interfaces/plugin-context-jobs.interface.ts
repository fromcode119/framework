/**
 * The `context.jobs` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextJobs {
  worker(processor: (job: any) => Promise<any>, options?: any): void;
  add(name: string, data: any, options?: any): Promise<any>;
}
