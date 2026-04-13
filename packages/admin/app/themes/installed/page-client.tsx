"use client";

import InstalledThemesView from './components/installed-themes-view';
import { InstalledThemesPageController } from './installed-themes-page-controller';

export default function InstalledThemesPageClient() {
  const model = InstalledThemesPageController.useModel();

  return (
    <InstalledThemesView
      closeUploadPreview={model.closeUploadPreview}
      confirmUploadPreview={model.confirmUploadPreview}
      fileInputRef={model.fileInputRef}
      handleDragLeave={model.handleDragLeave}
      handleDragOver={model.handleDragOver}
      handleDrop={model.handleDrop}
      handleFileChange={model.handleFileChange}
      handleUploadClick={model.handleUploadClick}
      isDropActive={model.isDropActive}
      isInspectingUpload={model.isInspectingUpload}
      isUploading={model.isUploading}
      loading={model.loading}
      onActivate={model.onActivate}
      onDisable={model.onDisable}
      onDelete={model.onDelete}
      onUpdate={model.onUpdate}
      showUploadPreview={model.showUploadPreview}
      themes={model.themes}
      themeMode={model.themeMode}
      uploadPreviewDescription={model.uploadPreviewDescription}
      uploadPreviewSections={model.uploadPreviewSections}
      uploadPreviewTitle={model.uploadPreviewTitle}
      updateVersionForTheme={model.updateVersionForTheme}
    />
  );
}
