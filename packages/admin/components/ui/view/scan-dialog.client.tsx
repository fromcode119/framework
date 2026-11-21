import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { PureReactor, prop, state, ref, bound, Platform } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { Input } from '@/components/ui/view/input.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What `@zxing/browser` hands back to stop a running decode. */
interface IScanControls { stop(): void }

/**
 * Reads a barcode or a QR code with the device's camera and hands back the text in it.
 *
 * Opening it starts the rear camera (the browser asks for permission the first time); the first code
 * read stops the camera and calls `onResult`. Sound is never requested and nothing leaves the browser:
 * the decoder runs on the page. A field under the picture takes the code typed by hand or from a
 * keyboard scanner, so the dialog still works where there is no camera, no permission, or no https.
 * The camera stops when the dialog closes, when a code is read, and when the tab is hidden.
 *
 * Reads EAN-13/8, UPC-A/E, Code 128/39/93, ITF, Codabar, QR, Data Matrix and the other formats the
 * decoder knows.
 */
export class ScanDialog extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  /** The text in the code, trimmed. Called once per opening. */
  @prop declare onResult: (code: string) => void;
  /** The dialog's heading; "Scan a code" when not given. */
  @prop declare title?: string;
  /** One line under the heading, e.g. what will be searched. */
  @prop declare description?: ReactNode;

  @ref declare video: Ref<HTMLVideoElement>;
  @state phase: 'starting' | 'live' | 'failed' = 'starting';
  @state problem = '';
  @state typed = '';

  /** A mouse, not a finger: a keyboard scanner may be plugged in, and no on-screen keyboard covers the camera. */
  private static finePointer(): boolean {
    return Platform.isBrowser && window.matchMedia?.('(pointer: fine)').matches === true;
  }

  private controls: IScanControls | null = null;
  /** Bumped on every start and stop, so a camera that answers after the dialog closed is released. */
  private run = 0;

  componentDidMount(): void {
    if (Platform.isBrowser) document.addEventListener('visibilitychange', this.onVisibility);
    if (this.isOpen) void this.start();
  }

  componentDidUpdate(previous: { isOpen: boolean }): void {
    if (previous.isOpen === this.isOpen) return;
    if (this.isOpen) void this.start();
    else this.stop();
  }

  componentWillUnmount(): void {
    this.stop();
    if (Platform.isBrowser) document.removeEventListener('visibilitychange', this.onVisibility);
  }

  @bound private onVisibility(): void {
    if (document.hidden) this.stop();
    else if (this.isOpen && !this.controls) void this.start();
  }

  private stop(): void {
    this.run += 1;
    this.controls?.stop();
    this.controls = null;
  }

  private async start(): Promise<void> {
    this.stop();
    const run = this.run;
    this.phase = 'starting'; this.problem = ''; this.typed = '';
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.phase = 'failed'; this.problem = AdminI18n.t('ui.scan.insecure');
      return;
    }
    try {
      // The decoder is loaded only when a scan is asked for — it is not part of every console page.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      // The element mounts with the dialog's first frame, which may come after this call.
      while (!this.video.current && run === this.run) await new Promise((resolve) => setTimeout(resolve, 30));
      if (run !== this.run || !this.video.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        this.video.current,
        (result) => { if (result && run === this.run) this.found(result.getText()); },
      );
      if (run !== this.run) { controls.stop(); return; }
      this.controls = controls;
      this.phase = 'live';
    } catch (error) {
      if (run !== this.run) return;
      const reason = error instanceof Error && error.name === 'NotAllowedError'
        ? AdminI18n.t('ui.scan.denied')
        : AdminI18n.t('ui.scan.noCamera');
      this.phase = 'failed'; this.problem = reason;
    }
  }

  private found(raw: string): void {
    const code = raw.trim();
    if (!code) return;
    this.stop();
    this.onResult(code);
  }

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    this.typed = event.target.value;
  }

  @bound private submit(event?: FormEvent): void {
    event?.preventDefault();
    this.found(this.typed);
  }

  render(): ReactNode {
    const name = AdminClass.of('scan');
    return (
      <Dialog
        isOpen={this.isOpen}
        onClose={this.onClose}
        title={this.title ?? AdminI18n.t('ui.scan.title')}
        description={this.description ?? AdminI18n.t('ui.scan.description')}
        foot={(
          <>
            <Button variant={ButtonVariant.SECONDARY} type="button" onClick={this.onClose}>{AdminI18n.t('common.cancel')}</Button>
            <Button variant={ButtonVariant.PRIMARY} type="button" onClick={this.submit} disabled={!this.typed.trim()}>{AdminI18n.t('ui.scan.use')}</Button>
          </>
        )}
      >
        <div className={name}>
          {this.phase === 'failed'
            ? <p className={`${name}__problem`} role="alert">{this.problem}</p>
            : (
              <div className={`${name}__frame`}>
                <video ref={this.video} className={`${name}__video`} muted playsInline />
                <span className={`${name}__aim`} aria-hidden="true" />
                {this.phase === 'starting' ? <span className={`${name}__status`}>{AdminI18n.t('ui.scan.starting')}</span> : null}
              </div>
            )}
          <form onSubmit={this.submit}>
            <Input value={this.typed} onChange={this.change} placeholder={AdminI18n.t('ui.scan.manual')} aria-label={AdminI18n.t('ui.scan.manual')} className="w-full" autoFocus={this.phase === 'failed' || ScanDialog.finePointer()} />
          </form>
        </div>
      </Dialog>
    );
  }
}
