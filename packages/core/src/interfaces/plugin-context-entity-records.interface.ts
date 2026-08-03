/**
 * The `context.entityRecords` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextEntityRecords {
  registerProvider(input: {
    key: string;
    label: string;
    resolve: (ref: { personId?: any; userId?: any; email?: string | null }) => Promise<Array<{
      id: string;
      group: string;
      kind: string;
      title: string;
      subtitle?: string;
      status?: string;
      amount?: number;
      currency?: string;
      date?: string;
      href?: string;
      downloadUrl?: string;
      icon?: string;
      badges?: string[];
    }>>;
  }): any;
  unregister(key: string): void;
}
