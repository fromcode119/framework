/**
 * A dataset of personal data a plugin holds, declared to the framework as DATA.
 *
 * It carries METHOD NAMES, never functions. A plugin may run as an isolated guest, and a function
 * put in this payload cannot cross the structured-clone channel — the whole registration is refused
 * with `could not be cloned`. Names survive the crossing, and the framework calls them back.
 */
export interface IPersonalDataSourceDescriptor {
  /** Vendor namespace, e.g. `org.fromcode`. */
  namespace: string;
  pluginSlug: string;
  /** Unique within the plugin, e.g. `orders`. An operator's choice is stored against `slug:key`. */
  key: string;
  label: string;
  /** The fields this dataset holds, so an operator can see what an erasure reaches. */
  fields: string[];
  /** ONLY the strategies this dataset can honestly honour — never the full set. */
  strategies: string[];
  defaultStrategy: string;
  /** Names of methods on the registering plugin's public API. */
  methods: { export: string; erase: string };
}
