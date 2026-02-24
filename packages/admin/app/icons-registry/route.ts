import { NextResponse } from 'next/server';
import { generateAdminRegistryContent } from '@/lib/runtime-registry';

/**
 * Framework Icon Registry Proxy (Client-side)
 * This route generates an ESM module that proxies 'lucide-react' imports
 * to the centralized framework icon registry (window.FrameworkIcons).
 */

const cachedContent = generateAdminRegistryContent();

export async function GET() {
  return new NextResponse(cachedContent, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
