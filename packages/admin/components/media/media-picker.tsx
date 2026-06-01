"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { Search, Upload, X, Check, Image as ImageIcon, File, Loader2 } from 'lucide-react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { RootFramework } from '@fromcode119/react';
import { AdminTypography } from '@/lib/typography';
import { UiFieldUtils } from '@/lib/ui';

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  filesize: number;
  width?: number;
  height?: number;
  alt?: string;
}

interface MediaPickerProps {
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
  allowMultiple?: boolean;
}

interface MediaPickerState {
  items: MediaItem[];
  loading: boolean;
  uploading: boolean;
  search: string;
  selectedId: string | null;
  mounted: boolean;
}

export class MediaPicker extends React.Component<MediaPickerProps, MediaPickerState> {
  private readonly fileInputRef = React.createRef<HTMLInputElement>();

  state: MediaPickerState = { items: [], loading: true, uploading: false, search: '', selectedId: null, mounted: false };

  private fetchMedia = async (): Promise<void> => {
    const { search } = this.state;
    this.setState({ loading: true });
    try {
      const query = search ? `?q=${encodeURIComponent(search)}` : '';
      const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}${query}`);
      this.setState({ items: Array.isArray(result) ? result : result.docs || [] });
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      this.setState({ loading: false });
    }
  };

  componentDidMount(): void {
    this.setState({ mounted: true });
    void this.fetchMedia();
  }

  componentDidUpdate(_prevProps: MediaPickerProps, prevState: MediaPickerState): void {
    if (prevState.search !== this.state.search) void this.fetchMedia();
  }

  private handleUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const { onSelect, onClose } = this.props;
    const file = e.target.files?.[0];
    if (!file) return;

    this.setState({ uploading: true });
    try {
      const formData = new FormData();
      formData.append('file', file);

      // First upload file (assuming specialized endpoint or generic collection upload)
      // If no specialized endpoint, we'd use the general collection create with multipart
      const result = await AdminApi.upload(`${AdminConstants.ENDPOINTS.MEDIA.UPLOAD}`, formData);

      // Refresh list and select the new item
      await this.fetchMedia();
      if (result.id || result.doc?.id) {
          const newItem = result.doc || result;
          this.setState({ selectedId: newItem.id });
          onSelect(newItem);
          onClose();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      this.setState({ uploading: false });
    }
  };

  render(): React.ReactNode {
    const { onSelect, onClose } = this.props;
    const { items, loading, uploading, search, selectedId, mounted } = this.state;
    const setSearch = (v: string) => this.setState({ search: v });
    const setSelectedId = (v: string | null) => this.setState({ selectedId: v });
    const selectedItem = items.find(i => i.id === selectedId);

    if (!mounted) return null;

    return createPortal(
    <RootFramework>
      <div className="fixed inset-0 z-[2147483000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[80vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className={`${AdminTypography.TYPOGRAPHY.HEADING.SUBTLE} text-slate-900 dark:text-white`}>Media Library</h2>
              <p className={AdminTypography.TYPOGRAPHY.SUBTEXT}>Select or upload an asset to your project</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-8 py-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Search media..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full h-10 pl-10 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${AdminTypography.TYPOGRAPHY.LABEL}`}
              />
            </div>
            <input
              type="file"
              ref={this.fileInputRef}
              className="hidden"
              onChange={this.handleUpload}
              accept="image/*,video/*,application/pdf"
            />
            <Button
              onClick={() => this.fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
            >
              {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              <span className="text-[11px] font-semibold">Upload New</span>
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Grid */}
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-transparent">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              ) : items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon size={48} className="mb-4 opacity-20" />
                  <p className={AdminTypography.TYPOGRAPHY.LABEL}>No media found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {items.map(item => {
                    const isImage = item.mimeType.startsWith('image/');
                    const isSelected = selectedId === item.id;

                    return (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        onDoubleClick={() => {
                          onSelect(item);
                          onClose();
                        }}
                        className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          isSelected 
                            ? 'border-indigo-500 ring-4 ring-indigo-500/10' 
                            : 'border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isImage ? (
                          <img 
                            src={item.url} 
                            alt={item.filename} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4">
                            <File size={32} className="text-slate-300 mb-2" />
                            <span className="text-[8px] font-semibold text-slate-400 text-center truncate w-full">{item.filename}</span>
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in-0">
                            <Check size={12} />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Details */}
            <div className="w-80 border-l border-slate-100 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 flex flex-col">
              {selectedItem ? (
                <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <div className="aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                    {selectedItem.mimeType.startsWith('image/') ? (
                      <img src={selectedItem.url} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <File size={40} className="text-slate-300" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className={UiFieldUtils.TEXT.LABEL}>Filename</h4>
                    <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">{selectedItem.filename}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className={UiFieldUtils.TEXT.LABEL}>Format</h4>
                      <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{selectedItem.mimeType.split('/')[1]}</p>
                    </div>
                    <div>
                      <h4 className={UiFieldUtils.TEXT.LABEL}>Size</h4>
                      <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{(selectedItem.filesize / 1024).toFixed(1)} KB</p>
                    </div>
                    {selectedItem.width && (
                      <div className="col-span-2">
                        <h4 className={UiFieldUtils.TEXT.LABEL}>Dimensions</h4>
                        <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{selectedItem.width} × {selectedItem.height} px</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                    <Button 
                      onClick={() => {
                        onSelect(selectedItem);
                        onClose();
                      }}
                      className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] transition-transform"
                    >
                      <span className="text-[11px] font-semibold">Insert Asset</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4">
                  <ImageIcon size={40} className="mb-4 opacity-10" />
                  <p className={UiFieldUtils.TEXT.SUBTEXT}>Select an item to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RootFramework>,
    document.body
    );
  }
}
