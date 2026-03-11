import { NextResponse } from 'next/server';
import { AdminRuntimeRegistry } from '@/lib/runtime-registry';

/**
 * Framework Icon Registry Proxy (Client-side)
 * This route generates an ESM module that proxies 'lucide-react' imports
 * to the centralized framework icon registry (window.FrameworkIcons).
 */

export async function GET() {
  return new NextResponse(
    AdminRuntimeRegistry.generateAdminRegistryContent(),
    {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}
