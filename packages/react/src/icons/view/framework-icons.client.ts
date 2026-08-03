import type React from 'react';
import { Platform } from '@fromcode119/reactor';
import { FrameworkIconRegistry } from '@react/icons/framework-icon-registry';
import { IconUtils } from '@react/icons/icon-utils';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';

export class FrameworkIcons {
  static readonly Dashboard = IconUtils.createProxyIcon('LayoutDashboard');
  static readonly LayoutDashboard = IconUtils.createProxyIcon('LayoutDashboard');
  static readonly Plugins = IconUtils.createProxyIcon('Puzzle');
  static readonly Users = IconUtils.createProxyIcon('Users');
  static readonly Settings = IconUtils.createProxyIcon('Settings');
  static readonly Media = IconUtils.createProxyIcon('Image');
  static readonly Layout = IconUtils.createProxyIcon('Layout');
  static readonly System = IconUtils.createProxyIcon('Zap');
  static readonly Menu = IconUtils.createProxyIcon('Menu');
  static readonly Search = IconUtils.createProxyIcon('Search');
  static readonly Sun = IconUtils.createProxyIcon('Sun');
  static readonly Moon = IconUtils.createProxyIcon('Moon');
  static readonly Bell = IconUtils.createProxyIcon('Bell');
  static readonly User = IconUtils.createProxyIcon('User');
  static readonly Logout = IconUtils.createProxyIcon('LogOut');
  static readonly Help = IconUtils.createProxyIcon('HelpCircle');
  static readonly Plus = IconUtils.createProxyIcon('Plus');
  static readonly Trash = IconUtils.createProxyIcon('Trash2');
  static readonly Edit = IconUtils.createProxyIcon('Pencil');
  static readonly Save = IconUtils.createProxyIcon('Save');
  static readonly Check = IconUtils.createProxyIcon('Check');
  static readonly Close = IconUtils.createProxyIcon('X');
  static readonly X = IconUtils.createProxyIcon('X');
  static readonly Refresh = IconUtils.createProxyIcon('RefreshCw');
  static readonly More = IconUtils.createProxyIcon('MoreHorizontal');
  static readonly MoreVertical = IconUtils.createProxyIcon('MoreVertical');
  static readonly ChevronDown = IconUtils.createProxyIcon('ChevronDown');
  static readonly ChevronRight = IconUtils.createProxyIcon('ChevronRight');
  static readonly ChevronLeft = IconUtils.createProxyIcon('ChevronLeft');
  static readonly ChevronUp = IconUtils.createProxyIcon('ChevronUp');
  static readonly Left = IconUtils.createProxyIcon('ArrowLeft');
  static readonly Right = IconUtils.createProxyIcon('ArrowRight');
  static readonly ArrowRight = IconUtils.createProxyIcon('ArrowRight');
  static readonly ArrowLeft = IconUtils.createProxyIcon('ArrowLeft');
  static readonly ArrowUp = IconUtils.createProxyIcon('ArrowUp');
  static readonly ArrowDown = IconUtils.createProxyIcon('ArrowDown');
  static readonly Home = IconUtils.createProxyIcon('Home');
  static readonly Layers = IconUtils.createProxyIcon('Layers');
  static readonly Wallet = IconUtils.createProxyIcon('Wallet');
  static readonly Gift = IconUtils.createProxyIcon('Gift');
  static readonly ArrowLeftRight = IconUtils.createProxyIcon('ArrowLeftRight');
  static readonly ShoppingBag = IconUtils.createProxyIcon('ShoppingBag');
  static readonly Package = IconUtils.createProxyIcon('Package');
  static readonly Loader = IconUtils.createProxyIcon('Loader2');
  static readonly Shield = IconUtils.createProxyIcon('Shield');
  static readonly ShieldCheck = IconUtils.createProxyIcon('ShieldCheck');
  static readonly ShieldAlert = IconUtils.createProxyIcon('ShieldAlert');
  static readonly Database = IconUtils.createProxyIcon('Database');
  static readonly Globe = IconUtils.createProxyIcon('Globe');
  static readonly Orbit = IconUtils.createProxyIcon('Orbit');
  static readonly Palette = IconUtils.createProxyIcon('Palette');
  static readonly Mail = IconUtils.createProxyIcon('Mail');
  static readonly Link = IconUtils.createProxyIcon('Link');
  static readonly Activity = IconUtils.createProxyIcon('Activity');
  static readonly Alert = IconUtils.createProxyIcon('AlertCircle');
  static readonly Info = IconUtils.createProxyIcon('Info');
  static readonly Warning = IconUtils.createProxyIcon('AlertTriangle');
  static readonly Clock = IconUtils.createProxyIcon('Clock');
  static readonly Terminal = IconUtils.createProxyIcon('Terminal');
  static readonly Box = IconUtils.createProxyIcon('Box');
  static readonly Download = IconUtils.createProxyIcon('Download');
  static readonly Up = IconUtils.createProxyIcon('ArrowUp');
  static readonly Down = IconUtils.createProxyIcon('ArrowDown');
  static readonly Eye = IconUtils.createProxyIcon('Eye');
  static readonly Code = IconUtils.createProxyIcon('Code');
  static readonly File = IconUtils.createProxyIcon('File');
  static readonly Upload = IconUtils.createProxyIcon('Upload');
  static readonly Grid = IconUtils.createProxyIcon('LayoutGrid');
  static readonly List = IconUtils.createProxyIcon('List');
  static readonly FolderPlus = IconUtils.createProxyIcon('FolderPlus');
  static readonly Folder = IconUtils.createProxyIcon('Folder');
  static readonly External = IconUtils.createProxyIcon('ExternalLink');
  static readonly Lock = IconUtils.createProxyIcon('Lock');
  static readonly UserCheck = IconUtils.createProxyIcon('UserCheck');
  static readonly Calendar = IconUtils.createProxyIcon('Calendar');
  static readonly Zap = IconUtils.createProxyIcon('Zap');
  static readonly Text = IconUtils.createProxyIcon('Type');
  static readonly Image = IconUtils.createProxyIcon('Image');
  static readonly Fingerprint = IconUtils.createProxyIcon('Fingerprint');
  static readonly Key = IconUtils.createProxyIcon('Key');
  static readonly MessageSquare = IconUtils.createProxyIcon('MessageSquare');
  static readonly ListChecks = IconUtils.createProxyIcon('ListChecks');
  static readonly Send = IconUtils.createProxyIcon('Send');
  static readonly Wrench = IconUtils.createProxyIcon('Wrench');
  static readonly ExternalLink = IconUtils.createProxyIcon('ExternalLink');
  static readonly Star = IconUtils.createProxyIcon('Star');
  static readonly CheckCircle = IconUtils.createProxyIcon('CheckCircle');
  static readonly CheckCircle2 = IconUtils.createProxyIcon('CheckCircle2');
  static readonly UserPlus = IconUtils.createProxyIcon('UserPlus');
  static readonly Puzzle = IconUtils.createProxyIcon('Puzzle');
  static readonly BookOpen = IconUtils.createProxyIcon('BookOpen');
  static readonly Tag = IconUtils.createProxyIcon('Tag');
  static readonly Filter = IconUtils.createProxyIcon('Filter');
  static readonly Copy = IconUtils.createProxyIcon('Copy');
  static readonly Share = IconUtils.createProxyIcon('Share2');
  static readonly Heart = IconUtils.createProxyIcon('Heart');
  static readonly Award = IconUtils.createProxyIcon('Award');
  static readonly Briefcase = IconUtils.createProxyIcon('Briefcase');
  static readonly Map = IconUtils.createProxyIcon('Map');
  static readonly Mic = IconUtils.createProxyIcon('Mic');
  static readonly Video = IconUtils.createProxyIcon('Video');
  static readonly Camera = IconUtils.createProxyIcon('Camera');
  static readonly Music = IconUtils.createProxyIcon('Music');
  static readonly Play = IconUtils.createProxyIcon('Play');
  static readonly Pause = IconUtils.createProxyIcon('Pause');
  static readonly Stop = IconUtils.createProxyIcon('Square');

  static registerIconProvider(name: string, provider: Record<string, any>): void {
    FrameworkIconRegistry.registerProvider(name, provider);
  }

  static iconNames(): string[] {
    return Object.keys(FrameworkIcons);
  }

  static allIconNames(): string[] {
    return LucideLazyLoader.iconNames();
  }

  static createProxyIcon(name: string): React.ForwardRefExoticComponent<Omit<any, 'ref'> & React.RefAttributes<unknown>> {
    return IconUtils.createProxyIcon(name);
  }

  static getIcon(name: string): React.ComponentType<any> {
    if (!Platform.isBrowser) {
      return () => null;
    }

    const cache = FrameworkIcons.getProxyCache();
    const existing = cache.get(name);
    if (existing) {
      return existing;
    }

    const component = FrameworkIcons.createProxyIcon(name);
    cache.set(name, component);
    return component;
  }

  private static getProxyCache(): Map<string, React.ComponentType<any>> {
    const globalWindow = window as any;
    if (!globalWindow._proxyIconCache) {
      globalWindow._proxyIconCache = new Map<string, React.ComponentType<any>>();
    }

    return globalWindow._proxyIconCache;
  }
}

/** All framework icon names (a `keyof` derivation — genuinely stays a `type`). */
