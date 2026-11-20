import type { ReactNode } from 'react';
import {Reactor, prop, state, bound, Platform} from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';

export class Lightbox extends Reactor {
  @prop declare images: string[];
  @prop declare currentIndex: number;
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare onNavigate: (index: number) => void;
  @prop declare title?: string;

  @state mounted = false;

  @bound private handlePrev(): void {
    const { images, currentIndex, onNavigate } = this;
    if (images.length <= 1) return;
    onNavigate((currentIndex - 1 + images.length) % images.length);
  }

  @bound private handleNext(): void {
    const { images, currentIndex, onNavigate } = this;
    if (images.length <= 1) return;
    onNavigate((currentIndex + 1) % images.length);
  }

  @bound private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (e.key === 'Escape') this.onClose();
    if (e.key === 'ArrowLeft') this.handlePrev();
    if (e.key === 'ArrowRight') this.handleNext();
  }

  private applyOpenSideEffects(): void {
    if (!Platform.isBrowser) return;
    document.body.style.overflow = this.isOpen ? 'hidden' : '';
  }

  componentDidMount(): void {
    this.mounted = true;
    if (Platform.hasWindow) window.addEventListener('keydown', this.handleKeyDown);
    this.applyOpenSideEffects();
  }

  componentDidUpdate(prevProps: { isOpen: boolean }): void {
    if (prevProps.isOpen !== this.isOpen) this.applyOpenSideEffects();
  }

  componentWillUnmount(): void {
    if (Platform.hasWindow) window.removeEventListener('keydown', this.handleKeyDown);
    if (Platform.isBrowser) document.body.style.overflow = '';
  }

  /**
   * A picture over the whole console: a bar on top with what it is, where it is in the set and ✕, the
   * picture in the middle, and ‹ › at the sides only when there is more than one. Every colour and size
   * is a `fc-lightbox` rule in `admin.css`; the buttons are the console's own.
   */
  render(): ReactNode {
    const { images, currentIndex, isOpen, onClose, title } = this;
    if (!isOpen || !this.mounted) return null;
    const many = images.length > 1;
    const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

    return this.portal(
      <div className="fc-lightbox" role="dialog" aria-modal="true" aria-label={title || AdminI18n.t('ui.lightbox.title')} onClick={onClose}>
        <div className="fc-lightbox__bar" onClick={stop}>
          <span className="fc-lightbox__title">{title || AdminI18n.t('ui.lightbox.title')}</span>
          {many ? <span className="fc-lightbox__count">{AdminI18n.t('ui.lightbox.image', { number: currentIndex + 1 })} / {images.length}</span> : null}
          <Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label={AdminI18n.t('common.close')} onClick={onClose}>
            <FrameworkIcons.Close size={15} />
          </Button>
        </div>
        <div className="fc-lightbox__stage">
          {many ? (
            <Button className="fc-lightbox__nav" variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label={AdminI18n.t('ui.lightbox.previous')} onClick={(e: { stopPropagation(): void }) => { stop(e); this.handlePrev(); }}>
              <FrameworkIcons.Left size={15} />
            </Button>
          ) : null}
          <img className="fc-lightbox__image" src={images[currentIndex]} alt={AdminI18n.t('ui.lightbox.image', { number: currentIndex + 1 })} onClick={stop} />
          {many ? (
            <Button className="fc-lightbox__nav" variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label={AdminI18n.t('ui.lightbox.next')} onClick={(e: { stopPropagation(): void }) => { stop(e); this.handleNext(); }}>
              <FrameworkIcons.Right size={15} />
            </Button>
          ) : null}
        </div>
      </div>,
      document.body,
    );
  }
}
