export interface IFileDropzoneProps {
  /** What the browser will accept, e.g. `.tar.gz,.tgz`. */
  accept?: string;
  /** The chosen file, owned by the parent so it survives a re-render. */
  file: File | null;
  onSelect: (file: File | null) => void;
  /** 0-100 while a transfer is running; anything else hides the bar. */
  percent?: number;
  busy?: boolean;
  /** Shown when nothing is chosen. */
  hint?: string;
  disabled?: boolean;
}
