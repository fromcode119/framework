/**
 * What a settings form says about one of its sections — the heading its fields name in `admin.section`.
 *
 * The heading itself is the fields' own `admin.section`; this adds the one line under it. `name` is the
 * heading's key: its `admin.sectionKey`, or the heading slugified when a field declares none — the same
 * key its translation is filed under (`admin.settings.sections.<name>.label | description`).
 */
export interface ISettingsSection {
  name: string;
  label?: string;
  description?: string;
}
