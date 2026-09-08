import { NextResponse, type NextRequest } from 'next/server';

/**
 * Ruteo por subdominio.
 *
 *   supersol.nexotienda.app  →  /s/supersol
 *   morrison.nexotienda.app  →  /s/morrison
 *
 * No decidimos acá si el subdominio es un comercio o un pueblo: eso lo resuelve la
 * página consultando a NexoPOS. El proxy corre en cada request y no queremos
 * meterle una llamada de red.
 */
const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'nexotienda.app';

/** Subdominios que no son ni comercio ni pueblo. */
const RESERVED = new Set(['www', 'api', 'admin', 'assets', 'static']);

function subdomainOf(host: string): string | null {
  const clean = host.split(':')[0].toLowerCase();

  // Desarrollo: supersol.localhost
  if (clean.endsWith('.localhost')) {
    const sub = clean.slice(0, -'.localhost'.length);
    return sub && !RESERVED.has(sub) ? sub : null;
  }

  if (clean === ROOT || clean === `www.${ROOT}`) return null;
  if (!clean.endsWith(`.${ROOT}`)) return null;

  const sub = clean.slice(0, -(ROOT.length + 1));
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return null;
  return sub;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const sub = subdomainOf(host);
  if (!sub) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (url.pathname.startsWith('/s/')) return NextResponse.next();
  url.pathname = `/s/${sub}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
