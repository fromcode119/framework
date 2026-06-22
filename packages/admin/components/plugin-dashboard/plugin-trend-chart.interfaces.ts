export interface PluginTrendSeries {
  label: string;
  /** One numeric value per x point. */
  data: number[];
  /** Tailwind-ish hex/color for the line+fill, e.g. '#6366f1'. Defaults to indigo. */
  color?: string;
}

export interface PluginTrendChartProps {
  series: PluginTrendSeries[];
  /** X-axis labels, one per data point (e.g. dates). */
  xLabels: string[];
  /** Chart body height in px (default 150). */
  height?: number;
  /** Format a y value for the tooltip/peak label. */
  formatValue?: (value: number) => string;
  className?: string;
}
