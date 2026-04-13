import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export async function GET() {
  const iconPath = path.join(process.cwd(), 'public', 'favicon.ico');
  const icon = await readFile(iconPath);

  return new NextResponse(icon, {
    status: 200,
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=86400',
    }
  });
}
