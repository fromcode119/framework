import { NextResponse } from 'next/server';

// Prevent favicon.ico 404 noise until a project-specific icon is uploaded.
export async function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

