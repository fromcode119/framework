import { PublicRouteProxy } from '../../lib/public-route-proxy';

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicRoute: string }> },
): Promise<Response> {
  const params = await context.params;
  const publicRoute = String(params?.publicRoute || '').trim();
  return PublicRouteProxy.getResponse(`${publicRoute}.xml`);
}