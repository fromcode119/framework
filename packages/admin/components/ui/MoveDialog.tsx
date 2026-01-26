"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Button } from './Button';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';

const { Folder, Left, Loader, Check } = FrameworkIcons;

interface MediaFolder {
  id: number;
  name: string;
  parentId: number | null;
}

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetFolderId: number | null) => void;
  title?: string;
  isLoading?: boolean;
}

export function MoveDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Move to Folder",
  isLoading = false 
}: MoveDialogProps) {
  const { theme } = useTheme();
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState<MediaFolder[]>([]);

  const fetchFolders = async (parentId: number | null) => {
    setLoading(true);
    try {
      const pId = parentId === null ? 'null' : parentId;
      const data = await api.get(`${ENDPOINTS.MEDIA.BASE}/folders?parentId=${pId}`);
      setFolders(data);
      
      if (parentId) {
        const pathData = await api.get(`${ENDPOINTS.MEDIA.BASE}/folders/${parentId}/path`);
        setPath(pathData);
      } else {
        setPath([]);
      }
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders(null);
      setCurrentParentId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 ${
          theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'
        }`}
      >
        <div className="p-6">
          <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h3>
          
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/10 mb-4">
            <button 
              onClick={() => {
                setCurrentParentId(null);
                fetchFolders(null);
              }}
              className={`text-[10px] font-black uppercase tracking-widest ${currentParentId === null ? 'text-indigo-500' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Root
            </button>
            {path.map((folder) => (
              <React.Fragment key={folder.id}>
                <span className="text-slate-400 text-[10px]">/</span>
                <button 
                  onClick={() => {
                    setCurrentParentId(folder.id);
                    fetchFolders(folder.id);
                  }}
                  className={`text-[10px] font-black uppercase tracking-widest ${currentParentId === folder.id ? 'text-indigo-500' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 mb-6 min-h-[120px]">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <Loader className="animate-spin text-indigo-500" size={24} />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-slate-500 text-sm">
                <p>No subfolders found</p>
              </div>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setCurrentParentId(folder.id);
                    fetchFolders(folder.id);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    theme === 'dark' 
                      ? 'hover:bg-slate-800 text-slate-300 hover:text-white' 
                      : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Folder size={18} className="text-amber-500" />
                  <span className="flex-1 font-medium">{folder.name}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => onConfirm(currentParentId)}
              disabled={isLoading}
            >
              {isLoading ? <Loader className="animate-spin" size={18} /> : <Check size={18} />}
              <span>Move Here</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
