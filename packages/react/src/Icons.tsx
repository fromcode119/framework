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
    if (!name) return null;
    if (this.cache.has(name)) return this.cache.get(name)!;

    // Normalize name to PascalCase for searching providers like Lucide
    const pascalName = name.charAt(0).toUpperCase() + name.slice(1);

    // 1. Search in explicit FrameworkIcons (Host apps)
    const frameworkIcons = (window as any).FrameworkIcons;
    if (frameworkIcons && (frameworkIcons[name] || frameworkIcons[pascalName])) {
      return frameworkIcons[name] || frameworkIcons[pascalName];
    }

    // 2. Search in registered providers
    for (const provider of Object.values(this.providers)) {
      if (provider[name]) {
        this.cache.set(name, provider[name]);
        return provider[name];
      }
      if (provider[pascalName]) {
        this.cache.set(name, provider[pascalName]);
        return provider[pascalName];
      }
    }

    // 3. Fallback to global window objects (legacy/bridge support)
    const lucide = (window as any).Lucide;
    if (lucide && (lucide[name] || lucide[pascalName])) return lucide[name] || lucide[pascalName];
    
    const fa = (window as any).FontAwesome;
    if (fa && (fa[name] || fa[pascalName])) return fa[name] || fa[pascalName];

    return null;
  }
}

// Global singleton instance
const registry = new IconRegistry();
registry.registerProvider('lucide', Lucide);
export const FrameworkIconRegistry = registry;

/**
 * Framework Standard Icon Mapping
 * This defines the "system" icons used by the framework UI (Sidebar, Header, etc).
 */
export const FrameworkIcons = {
  // Navigation & Shell
  Dashboard: Lucide.LayoutDashboard,
  LayoutDashboard: Lucide.LayoutDashboard,
  Plugins: Lucide.Puzzle,
  Users: Lucide.Users,
  Settings: Lucide.Settings,
  Media: Lucide.Image,
  Layout: Lucide.Layout,
  System: Lucide.Zap,
  Menu: Lucide.Menu,
  Search: Lucide.Search,
  Sun: Lucide.Sun,
  Moon: Lucide.Moon,
  Bell: Lucide.Bell,
  User: Lucide.User,
  Logout: Lucide.LogOut,
  Help: Lucide.HelpCircle,
  Plus: Lucide.Plus,
  Trash: Lucide.Trash2,
  Edit: Lucide.Pencil,
  Save: Lucide.Save,
  Check: Lucide.Check,
  Close: Lucide.X,
  X: Lucide.X,
  Refresh: Lucide.RefreshCw,
  More: Lucide.MoreHorizontal,
  ChevronDown: Lucide.ChevronDown,
  ChevronRight: Lucide.ChevronRight,
  ChevronLeft: Lucide.ChevronLeft,
  ChevronUp: Lucide.ChevronUp,
  
  // Framework specific additions for Admin UI
  Left: Lucide.ArrowLeft,
  Right: Lucide.ArrowRight,
  ArrowRight: Lucide.ArrowRight,
  ArrowLeft: Lucide.ArrowLeft,
  ArrowUp: Lucide.ArrowUp,
  ArrowDown: Lucide.ArrowDown,
  Home: Lucide.Home,
  Layers: Lucide.Layers,
  Wallet: Lucide.Wallet,
  Gift: Lucide.Gift,
  ArrowLeftRight: Lucide.ArrowLeftRight,
  ShoppingBag: Lucide.ShoppingBag,
  Package: Lucide.Package,
  Loader: Lucide.Loader2,
  Shield: Lucide.Shield,
  ShieldCheck: Lucide.ShieldCheck,
  ShieldAlert: Lucide.ShieldAlert,
  Database: Lucide.Database,
  Globe: Lucide.Globe,
  Orbit: Lucide.Orbit,
  Palette: Lucide.Palette,
  Mail: Lucide.Mail,
  Link: Lucide.Link,
  Activity: Lucide.Activity,
  Alert: Lucide.AlertCircle,
  Warning: Lucide.AlertTriangle,
  Clock: Lucide.Clock,
  Terminal: Lucide.Terminal,
  Box: Lucide.Box,
  Download: Lucide.Download,
  Up: Lucide.ArrowUp,
  Down: Lucide.ArrowDown,
  Eye: Lucide.Eye,
  Code: Lucide.Code,
  File: Lucide.File,
  Upload: Lucide.Upload,
  Grid: Lucide.LayoutGrid,
  List: Lucide.List,
  FolderPlus: Lucide.FolderPlus,
  Folder: Lucide.Folder,
  External: Lucide.ExternalLink,
  Lock: Lucide.Lock,
  UserCheck: Lucide.UserCheck,
  Calendar: Lucide.Calendar,
  Zap: Lucide.Zap,
  Text: Lucide.Type,
  Image: Lucide.Image,
  Fingerprint: Lucide.Fingerprint,
  Key: Lucide.Key,
};

/**
 * Register a new icon provider.
 */
export const registerIconProvider = (name: string, provider: Record<string, any>) => {
  registry.registerProvider(name, provider);
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

if (typeof window !== 'undefined') {
  // Expose Lucide namespace for icon registry system
  (window as any).Lucide = Lucide;
}
