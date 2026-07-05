export interface NumberStepperProps {
  value: number | string | null | undefined;
  onChange: (value: number | string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  /** Increment applied by the +/- controls (and native arrows). Defaults to 1. */
  step?: number;
  min?: number;
  max?: number;
  /** 'sm' = compact variant for dense grids (e.g. the per-tier rate matrix). Default 'md'. */
  size?: 'sm' | 'md';
}
