import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';

/**
 * The pictures of one thing — an extension's screens, a theme's pages — as a card: the chosen picture
 * large, the rest as a strip under it. Pressing the large one asks the page to open it full size.
 *
 * With no pictures the card is not drawn: a frame around nothing says less than no frame.
 */
export class ScreenshotGallery extends PureReactor {
  declare props: Pick<ScreenshotGallery, 'title' | 'images' | 'active' | 'alt' | 'onSelect' | 'onOpen'>;

  @prop declare title: string;
  @prop declare images: string[];
  /** Which picture is large. */
  @prop declare active: number;
  /** What the pictures show, for a reader who cannot see them. */
  @prop declare alt: string;
  @prop declare onSelect: (index: number) => void;
  /** Asked when the large picture is pressed; the page owns the full-size view. */
  @prop declare onOpen?: () => void;

  render(): ReactNode {
    const { images, alt } = this;
    if (!images.length) return null;
    const active = Math.min(Math.max(this.active, 0), images.length - 1);
    return (
      <RecordCard title={this.title} count={images.length}>
        <div className="fc-gallery">
          <button type="button" className="fc-gallery__main" onClick={this.onOpen} aria-label={alt}>
            <img src={images[active]} alt={alt} />
          </button>
          {images.length > 1 ? (
            <div className="fc-gallery__strip">
              {images.map((src, index) => (
                <button key={src + index} type="button" className="fc-gallery__thumb" aria-current={index === active ? 'true' : undefined} aria-label={`${alt} ${index + 1}`} onClick={() => this.onSelect(index)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </RecordCard>
    );
  }
}
