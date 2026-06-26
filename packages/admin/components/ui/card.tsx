"use client";

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: string;
  icon?: React.ReactNode;
}

export class Card extends React.Component<CardProps> {
  render(): React.ReactNode {
    const { children, className = "", noPadding = false, title, ...props } = this.props;
  return (
    <div
      {...props}
      className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm ${noPadding ? '' : 'p-4'} ${className}`}
    >
      {title && <h3 className="mb-3 text-[13px] font-semibold tracking-tight text-[var(--card-foreground)]">{title}</h3>}
      {children}
    </div>
  );
  }
}
