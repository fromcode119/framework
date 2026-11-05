/**
 * How one image is laid over another. Every value is the caller's — this package invents none of them.
 *
 * `position` is one of the nine anchors in `MediaImageOverlay.POSITIONS`. The three percentages are of
 * the BASE image: `sizePercent` is the overlay's width as a share of the base's width, `marginPercent`
 * the gap kept from the anchored edges as a share of the base's shorter side.
 */
export interface IMediaImageOverlayOptions {
  position: string;
  opacityPercent: number;
  sizePercent: number;
  marginPercent: number;
  /** The base is scaled to fit inside this box first (never enlarged), as an optimized variant is. */
  maxWidth: number;
  maxHeight: number;
  quality: number;
}
