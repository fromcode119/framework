export interface IPluginTrendSeries {
  label: string;
  /** One numeric value per x point. */
  data: number[];
  /** Tailwind-ish hex/color for the line+fill, e.g. '#6366f1'. Defaults to indigo. */
  color?: string;
}
