export interface LocalizedTextFieldProps {
  /** Per-locale value object `{ en: '…', bg: '…' }`, or a legacy plain string. */
  value: any;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  multiline?: boolean;
  field?: { label?: string; name?: string };
}
