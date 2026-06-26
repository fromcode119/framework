"use client";

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
  as?: any;
  href?: string;
  target?: string;
}

export class Button extends React.Component<ButtonProps> {
  render(): React.ReactNode {
    const { 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '', 
  isLoading, 
  icon,
  as: Component = 'button',
  ...props 
} = this.props;
  const variants = {
    primary: 'bg-[var(--primary)] hover:brightness-95 text-[var(--primary-foreground)] shadow-sm',
    secondary: 'bg-[var(--secondary)] border border-[var(--border)] text-[var(--secondary-foreground)] shadow-sm hover:brightness-98',
    danger: 'bg-[var(--destructive)] hover:brightness-95 text-[var(--destructive-foreground)] shadow-sm',
    ghost: 'hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
    outline: 'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]',
  };

  const sizes = {
    sm: 'h-8 px-3 text-[10px]',
    md: 'h-10 px-4 text-[12px]',
    lg: 'h-11 px-6 text-[13px]',
    icon: 'h-10 w-10 p-0',
  };

  const spinnerColor = variant === 'primary' || variant === 'danger' 
    ? 'border-white/20 border-t-white' 
    : 'border-[color-mix(in_srgb,var(--primary)_20%,transparent)] border-t-[var(--primary)]';

  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <div className={`h-4 w-4 border-2 rounded-full animate-spin ${spinnerColor}`} />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </Component>
  );
  }
}
