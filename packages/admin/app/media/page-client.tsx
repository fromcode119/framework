"use client";

import MediaPageView from './components/media-page-view';
import { MediaPageController } from './media-page-controller';

export default function MediaPageClient() {
  const model = MediaPageController.useModel();

  return <MediaPageView {...model} />;
}
