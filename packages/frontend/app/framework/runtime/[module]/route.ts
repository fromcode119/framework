import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Runtime ESM Registry Handler
 * Serves the framework's internal libraries to plugins as ESM modules.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { module: string } }
) {
  const { module } = await params;
  
  const moduleMap: Record<string, string> = {
    'react': 'react.js',
    'react-dom': 'react-dom.js',
    'react-jsx': 'react-jsx.js',
    'lucide-react': 'lucide-react.js',
    'fontawesome': 'lucide-react.js',
    'fromcode-react': 'fromcode-react.js'
  };

  const fileName = moduleMap[module];
  if (!fileName) {
    return new NextResponse('Module not found', { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'packages/frontend/lib/runtime', fileName);
  
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    return new NextResponse(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (e) {
    return new NextResponse('Error loading module source', { status: 500 });
  }
}

