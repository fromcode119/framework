import type React from 'react';

export interface ClientLayoutChildrenProps {
  children: React.ReactNode;
}

export interface ClientLayoutHeaderProps {
  onMenuClick: () => void;
}
