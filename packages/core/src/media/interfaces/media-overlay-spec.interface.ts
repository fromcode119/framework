/**
 * An image laid over other images when they are served — a watermark. Every value comes from the
 * extension that configures it (in practice its admin settings); the framework supplies none.
 */
export interface IMediaOverlaySpec {
  /** The media library file laid on top. */
  overlayMediaId: string;
  /** One of the nine anchors: top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right. */
  position: string;
  opacityPercent: number;
  /** The overlay's width as a share of the image's width. */
  sizePercent: number;
  /** The gap from the anchored edges as a share of the image's shorter side. */
  marginPercent: number;
  /**
   * Only images uploaded on or after this day (YYYY-MM-DD) get the overlay; earlier ones keep their own
   * address — for a library whose older pictures already carry a mark. Absent: every image.
   */
  uploadedFrom?: string;
}
