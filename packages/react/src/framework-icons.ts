"use client";

import type React from 'react';
import * as Lucide from 'lucide-react';
import { FrameworkIconRegistry } from './framework-icon-registry';
import { IconUtils } from './icon-utils';

export class FrameworkIcons {
  static readonly Dashboard = Lucide.LayoutDashboard;
  static readonly LayoutDashboard = Lucide.LayoutDashboard;
  static readonly Plugins = Lucide.Puzzle;
  static readonly Users = Lucide.Users;
  static readonly Settings = Lucide.Settings;
  static readonly Media = Lucide.Image;
  static readonly Layout = Lucide.Layout;
  static readonly System = Lucide.Zap;
  static readonly Menu = Lucide.Menu;
  static readonly Search = Lucide.Search;
  static readonly Sun = Lucide.Sun;
  static readonly Moon = Lucide.Moon;
  static readonly Bell = Lucide.Bell;
  static readonly User = Lucide.User;
  static readonly Logout = Lucide.LogOut;
  static readonly Help = Lucide.HelpCircle;
  static readonly Plus = Lucide.Plus;
  static readonly Trash = Lucide.Trash2;
  static readonly Edit = Lucide.Pencil;
  static readonly Save = Lucide.Save;
  static readonly Check = Lucide.Check;
  static readonly Close = Lucide.X;
  static readonly X = Lucide.X;
  static readonly Refresh = Lucide.RefreshCw;
  static readonly More = Lucide.MoreHorizontal;
  static readonly MoreVertical = Lucide.MoreVertical;
  static readonly ChevronDown = Lucide.ChevronDown;
  static readonly ChevronRight = Lucide.ChevronRight;
  static readonly ChevronLeft = Lucide.ChevronLeft;
  static readonly ChevronUp = Lucide.ChevronUp;
  static readonly Left = Lucide.ArrowLeft;
  static readonly Right = Lucide.ArrowRight;
  static readonly ArrowRight = Lucide.ArrowRight;
  static readonly ArrowLeft = Lucide.ArrowLeft;
  static readonly ArrowUp = Lucide.ArrowUp;
  static readonly ArrowDown = Lucide.ArrowDown;
  static readonly Home = Lucide.Home;
  static readonly Layers = Lucide.Layers;
  static readonly Wallet = Lucide.Wallet;
  static readonly Gift = Lucide.Gift;
  static readonly ArrowLeftRight = Lucide.ArrowLeftRight;
  static readonly ShoppingBag = Lucide.ShoppingBag;
  static readonly Package = Lucide.Package;
  static readonly Loader = Lucide.Loader2;
  static readonly Shield = Lucide.Shield;
  static readonly ShieldCheck = Lucide.ShieldCheck;
  static readonly ShieldAlert = Lucide.ShieldAlert;
  static readonly Database = Lucide.Database;
  static readonly Globe = Lucide.Globe;
  static readonly Orbit = Lucide.Orbit;
  static readonly Palette = Lucide.Palette;
  static readonly Mail = Lucide.Mail;
  static readonly Link = Lucide.Link;
  static readonly Activity = Lucide.Activity;
  static readonly Alert = Lucide.AlertCircle;
  static readonly Info = Lucide.Info;
  static readonly Warning = Lucide.AlertTriangle;
  static readonly Clock = Lucide.Clock;
  static readonly Terminal = Lucide.Terminal;
  static readonly Box = Lucide.Box;
  static readonly Download = Lucide.Download;
  static readonly Up = Lucide.ArrowUp;
  static readonly Down = Lucide.ArrowDown;
  static readonly Eye = Lucide.Eye;
  static readonly Code = Lucide.Code;
  static readonly File = Lucide.File;
  static readonly Upload = Lucide.Upload;
  static readonly Grid = Lucide.LayoutGrid;
  static readonly List = Lucide.List;
  static readonly FolderPlus = Lucide.FolderPlus;
  static readonly Folder = Lucide.Folder;
  static readonly External = Lucide.ExternalLink;
  static readonly Lock = Lucide.Lock;
  static readonly UserCheck = Lucide.UserCheck;
  static readonly Calendar = Lucide.Calendar;
  static readonly Zap = Lucide.Zap;
  static readonly Text = Lucide.Type;
  static readonly Image = Lucide.Image;
  static readonly Fingerprint = Lucide.Fingerprint;
  static readonly Key = Lucide.Key;
  static readonly MessageSquare = Lucide.MessageSquare;
  static readonly ListChecks = Lucide.ListChecks;
  static readonly Send = Lucide.Send;
  static readonly Wrench = Lucide.Wrench;
  static readonly ExternalLink = Lucide.ExternalLink;
  static readonly Star = Lucide.Star;
  static readonly CheckCircle = Lucide.CheckCircle;
  static readonly CheckCircle2 = Lucide.CheckCircle2;
  static readonly UserPlus = Lucide.UserPlus;
  static readonly Puzzle = Lucide.Puzzle;
  static readonly BookOpen = Lucide.BookOpen;
  static readonly Tag = Lucide.Tag;
  static readonly Filter = Lucide.Filter;
  static readonly Copy = Lucide.Copy;
  static readonly Share = Lucide.Share2;
  static readonly Heart = Lucide.Heart;
  static readonly Award = Lucide.Award;
  static readonly Briefcase = Lucide.Briefcase;
  static readonly Map = Lucide.Map;
  static readonly Mic = Lucide.Mic;
  static readonly Video = Lucide.Video;
  static readonly Camera = Lucide.Camera;
  static readonly Music = Lucide.Music;
  static readonly Play = Lucide.Play;
  static readonly Pause = Lucide.Pause;
  static readonly Stop = Lucide.Square;

  static registerIconProvider(name: string, provider: Record<string, any>): void {
    FrameworkIconRegistry.registerProvider(name, provider);
  }

  static iconNames(): string[] {
    return Object.keys(FrameworkIcons);
  }

  static allIconNames(): string[] {
    return Object.keys(Lucide);
  }

  static createProxyIcon(name: string): React.ForwardRefExoticComponent<Omit<any, 'ref'> & React.RefAttributes<unknown>> {
    return IconUtils.createProxyIcon(name);
  }

  static getIcon(name: string): React.ComponentType<any> {
    if (typeof window === 'undefined') {
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