"use client";

import React, { forwardRef, createElement } from 'react';
import * as Lucide from 'lucide-react';

/**
 * Global Icon Registry for the framework.
 * This allows multiple icon libraries (Lucide, FontAwesome, etc.) 
 * to register themselves and be accessible via a unified getIcon() call.
 */
class IconRegistry {
  private providers: Record<string, any> = {};
  private cache: Map<string, React.ComponentType<any>> = new Map();

  /**
   * Register a new icon provider (e.g. window.Lucide)
   */
  registerProvider(name: string, provider: Record<string, any>) {
    this.providers[name] = provider;
    this.cache.clear(); // Clear cache when new providers are added
  }

  /**
   * Get an icon component by name, searching across all registered providers
   */
  getIcon(name: string): React.ComponentType<any> | null {
    if (this.cache.has(name)) return this.cache.get(name)!;

    // 1. Search in explicit FrameworkIcons (Host apps)
    if ((window as any).FrameworkIcons && (window as any).FrameworkIcons[name]) {
      return (window as any).FrameworkIcons[name];
    }

    // 2. Search in registered providers
    for (const provider of Object.values(this.providers)) {
      if (provider[name]) {
        this.cache.set(name, provider[name]);
        return provider[name];
      }
    }

    // 3. Fallback to global window objects (legacy/bridge support)
    if ((window as any).Lucide && (window as any).Lucide[name]) return (window as any).Lucide[name];
    if ((window as any).FontAwesome && (window as any).FontAwesome[name]) return (window as any).FontAwesome[name];

    return null;
  }
}

// Global singleton instance
const registry = new IconRegistry();
registry.registerProvider('lucide', Lucide);
export const FrameworkIconRegistry = registry;

/**
 * Framework Standard Icon Mapping
 * This defines the "System" icons used by the framework UI.
 * By defining this here, we ensure consistency between Admin, Frontend, and Plugins.
 */
export const FrameworkIcons = {
  // Navigation & Actions
  Dashboard: Lucide.LayoutDashboard,
  Plugins: Lucide.Puzzle,
  Users: Lucide.Users,
  Settings: Lucide.Settings,
  Media: Lucide.Image,
  Layout: Lucide.Layout,
  System: Lucide.Zap,
  Package: Lucide.Package,
  Menu: Lucide.Menu,
  Search: Lucide.Search,
  Link: Lucide.Link,
  Sun: Lucide.Sun,
  Moon: Lucide.Moon,
  Bell: Lucide.Bell,
  User: Lucide.User,
  Logout: Lucide.LogOut,
  Help: Lucide.HelpCircle,
  Down: Lucide.ChevronDown,
  Up: Lucide.ChevronUp,
  Right: Lucide.ChevronRight,
  Left: Lucide.ArrowLeft,
  ChevronLeft: Lucide.ChevronLeft,
  ChevronRight: Lucide.ChevronRight,
  ArrowLeft: Lucide.ArrowLeft,
  ArrowRight: Lucide.ArrowRight,
  Close: Lucide.X,
  X: Lucide.X,
  Home: Lucide.Home,
  Plus: Lucide.Plus,
  Trash: Lucide.Trash2,
  Edit: Lucide.Pencil,
  Save: Lucide.Save,
  Download: Lucide.Download,
  Upload: Lucide.Upload,
  Refresh: Lucide.RefreshCw,
  External: Lucide.ExternalLink,
  More: Lucide.MoreHorizontal,
  MoreVertical: Lucide.MoreVertical,
  Filter: Lucide.Filter,
  Calendar: Lucide.Calendar,
  UserCheck: Lucide.UserCheck,
  Eye: Lucide.Eye,
  Globe: Lucide.Globe,
  Palette: Lucide.Palette,
  Smartphone: Lucide.Smartphone,
  Layers: Lucide.Layers,
  Share: Lucide.Share2,
  Copy: Lucide.Copy,
  Maximize: Lucide.Maximize,
  PlusCircle: Lucide.PlusCircle,
  Minus: Lucide.Minus,

  // Status & Feedback
  Check: Lucide.CheckCircle2,
  Alert: Lucide.AlertCircle,
  Warning: Lucide.AlertTriangle,
  Info: Lucide.Info,
  Loader: Lucide.Loader2,
  
  // Content & Data
  File: Lucide.File,
  FileText: Lucide.FileText,
  Text: Lucide.FileText,
  Folder: Lucide.Folder,
  Grid: Lucide.Grid,
  List: Lucide.List,
  FolderPlus: Lucide.FolderPlus,
  Box: Lucide.Box,
  ShoppingBag: Lucide.ShoppingBag,
  Database: Lucide.Database,
  Terminal: Lucide.Terminal,
  Activity: Lucide.Activity,
  Clock: Lucide.Clock,
  History: Lucide.History,
  TrendingUp: Lucide.TrendingUp,
  CheckSquare: Lucide.CheckSquare,
  Code: Lucide.Code,
  Chart: Lucide.ChartNoAxesColumn,
  LayoutGrid: Lucide.LayoutGrid,
  Columns: Lucide.Columns,
  Quote: Lucide.Quote,
  Star: Lucide.Star,
  BarChart: Lucide.BarChart3,
  ArrowUpRight: Lucide.ArrowUpRight,
  
  // Auth & Security
  Mail: Lucide.Mail,
  Lock: Lucide.Lock,
  Shield: Lucide.ShieldCheck,
  ShieldCheck: Lucide.ShieldCheck,
  ShieldAlert: Lucide.ShieldAlert,
  UserPlus: Lucide.UserPlus,
  
  // Miscellaneous
  Orbit: Lucide.Orbit,
  Zap: Lucide.Zap,

  // Shims for backward compatibility/bridge safety
  registerProvider: (name: string, provider: Record<string, any>) => {
    registry.registerProvider(name, provider);
  },
  getIcon: (name: string) => {
    return registry.getIcon(name);
  }
};

export type IconName = keyof typeof FrameworkIcons;
export const IconNames = Object.keys(FrameworkIcons) as IconName[];

// All available icon names from the library
export const AllIconNames = Object.keys(Lucide);

/**
 * Creates a stable React component that proxies to the global Icon Registry.
 */
export function createProxyIcon(name: string) {
  const ProxyIcon = forwardRef((props: any, ref) => {
    const Icon = registry.getIcon(name);
    
    if (!Icon) {
      if (typeof window !== 'undefined' && (window as any).console) {
        if (!(window as any)._missingIcons) (window as any)._missingIcons = new Set();
        if (!(window as any)._missingIcons.has(name)) {
          (window as any)._missingIcons.add(name);
          console.warn(`[Icons] Icon "${name}" not found in any registered provider.`);
        }
      }
      return null;
    }
    
    return createElement(Icon, { ...props, ref });
  });

  ProxyIcon.displayName = `ProxyIcon(${name})`;
  return ProxyIcon;
}

/**
 * Hook or helper to get an icon component by name dynamically.
 * Returns a stable Proxy component that resolves to the actual icon at render time.
 */
export const getIcon = (name: string) => {
    if (typeof window === 'undefined') return () => null;
    
    if (!(window as any)._proxyIconCache) (window as any)._proxyIconCache = new Map();
    const cache = (window as any)._proxyIconCache;
    
    if (cache.has(name)) return cache.get(name);
    
    const Component = createProxyIcon(name);
    cache.set(name, Component);
    return Component;
};

// Re-export all Lucide icons for bridge/direct use
export * from 'lucide-react';
