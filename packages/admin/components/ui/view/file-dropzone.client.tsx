import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';

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

/**
 * Choose a file by DROPPING it, or by clicking — and see what is happening while it uploads.
 *
 * The control this replaces was a bare `<input type="file">` beside a button, which is the browser's
 * default and says nothing: no drop target, no file size, no way to tell a 14 MB archive apart from
 * an empty one, and a transfer that reported itself as the text `42%` next to the button. The upload
 * underneath was already chunked and already reported progress — none of it reached the operator.
 *
 * The native input is kept and merely hidden: it is what makes the keyboard and the file picker work,
 * and a div pretending to be an input is how that gets lost. The label wraps it, so a click anywhere
 * on the zone opens the picker without any script at all.
 */
export class FileDropzone extends AdminComponent<IFileDropzoneProps> {
  @state private dragging = false;

  private get transferring(): boolean {
    const percent = this.props.percent ?? -1;
    return Boolean(this.props.busy) && percent >= 0 && percent < 100;
  }

  @bound private onInputChange(event: ChangeEvent<HTMLInputElement>): void {
    this.props.onSelect(event.target.files?.[0] ?? null);
  }

  @bound private onDragOver(event: DragEvent<HTMLLabelElement>): void {
    if (this.props.disabled) return;
    // Without preventDefault the browser NAVIGATES to the dropped file and the page is gone.
    event.preventDefault();
    this.dragging = true;
  }

  @bound private onDragLeave(): void {
    this.dragging = false;
  }

  @bound private onDrop(event: DragEvent<HTMLLabelElement>): void {
    if (this.props.disabled) return;
    event.preventDefault();
    this.dragging = false;
    this.props.onSelect(event.dataTransfer?.files?.[0] ?? null);
  }

  @bound private clear(event: React.MouseEvent): void {
    // The clear control sits INSIDE the label, so without this the click also reopens the picker.
    event.preventDefault();
    event.stopPropagation();
    this.props.onSelect(null);
  }

  /** Bytes, in the unit a human reading a file listing would use. */
  private static size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
  }

  render(): ReactNode {
    const { file, accept, hint, disabled, percent = 0 } = this.props;
    const classes = ['fc-dropzone'];
    if (this.dragging) classes.push('fc-dropzone--over');
    if (disabled) classes.push('fc-dropzone--disabled');
    if (file) classes.push('fc-dropzone--filled');

    return (
      <label
        className={classes.join(' ')}
        onDragOver={this.onDragOver}
        onDragEnter={this.onDragOver}
        onDragLeave={this.onDragLeave}
        onDrop={this.onDrop}
      >
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={this.onInputChange}
          className="fc-dropzone__input"
        />

        <span className="fc-dropzone__icon" aria-hidden="true">
          <FrameworkIcons.Upload size={20} strokeWidth={2} />
        </span>

        {file ? (
          <span className="fc-dropzone__file">
            <span className="fc-dropzone__name">{file.name}</span>
            <span className="fc-dropzone__meta">{FileDropzone.size(file.size)}</span>
          </span>
        ) : (
          <span className="fc-dropzone__file">
            <span className="fc-dropzone__name">Drop a file here, or click to choose</span>
            {hint ? <span className="fc-dropzone__meta">{hint}</span> : null}
          </span>
        )}

        {file && !this.transferring && !disabled ? (
          <button type="button" className="fc-dropzone__clear" onClick={this.clear} aria-label="Remove the chosen file">
            <FrameworkIcons.Close size={14} />
          </button>
        ) : null}

        {this.transferring ? (
          <span className="fc-dropzone__progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span className="fc-dropzone__track">
              {/* The ONE inline style here, and it has to be: a fill width is a live value, not a
                  rule. Everything else about this control is in admin.css. */}
              <span className="fc-dropzone__bar" style={{ width: `${percent}%` }} />
            </span>
            <span className="fc-dropzone__percent">{percent}%</span>
          </span>
        ) : null}
      </label>
    );
  }
}
