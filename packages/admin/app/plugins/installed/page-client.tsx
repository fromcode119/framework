"use client";

import InstalledPluginsView from './components/installed-plugins-view';
import { InstalledPluginsPageController } from './installed-plugins-page-controller';

export default function InstalledPluginsPageClient() {
  const model = InstalledPluginsPageController.useModel();

  return (
    <InstalledPluginsView
      closeDeleteConfirm={model.closeDeleteConfirm}
      closeDependencyConfirm={model.closeDependencyConfirm}
      closeUploadPreview={model.closeUploadPreview}
      confirmUploadPreview={model.confirmUploadPreview}
      deleteConfirmDescription={model.deleteConfirmDescription}
      dependencyIssues={model.dependencyIssues}
      filteredPlugins={model.filteredPlugins}
      fileInputRef={model.fileInputRef}
      handleDragLeave={model.handleDragLeave}
      handleDragOver={model.handleDragOver}
      handleDrop={model.handleDrop}
      handleFileChange={model.handleFileChange}
      hasPluginUpdate={model.hasPluginUpdate}
      handleToggle={model.handleToggle}
      handleUploadClick={model.handleUploadClick}
      imageErrors={model.imageErrors}
      isActivating={model.isActivating}
      isDeleting={model.isDeleting}
      isDropActive={model.isDropActive}
      isInspectingUpload={model.isInspectingUpload}
      isUploading={model.isUploading}
      loading={model.loading}
      operationStatus={model.operationStatus}
      markImageError={model.markImageError}
      onDeleteConfirm={model.onDeleteConfirm}
      onDeletePrompt={model.onDeletePrompt}
      searchQuery={model.searchQuery}
      setSearchQuery={model.setSearchQuery}
      showDeleteConfirm={model.showDeleteConfirm}
      showDependencyConfirm={model.showDependencyConfirm}
      showUploadPreview={model.showUploadPreview}
      targetPlugin={model.targetPlugin}
      theme={model.theme}
      toggleDependencies={model.toggleDependencies}
      uploadProgressLabel={model.uploadProgressLabel}
      uploadProgressPercent={model.uploadProgressPercent}
      uploadPreviewDescription={model.uploadPreviewDescription}
      uploadPreviewSections={model.uploadPreviewSections}
      uploadPreviewTitle={model.uploadPreviewTitle}
    />
  );
}
