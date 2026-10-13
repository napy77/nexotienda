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

/**
 * `/s/<slug>/…` pedido desde un host que no es el de ese slug.
 *
 * Pasa con la página del pueblo, que enlaza a los comercios con `/s/<slug>`: sin
 * esto, alguien compraba en Jure bajo `morrison.nexotienda.app/s/jure/…`. Y eso rompe
 * tres cosas que dependen del origen: el carrito (`localStorage` es por origen), la
 * sesión (la cookie es por host) y la ida a ClubPay, que solo acepta volver a
 * `<slug>.nexotienda.app` (CR-0003). Se manda al subdominio del comercio, que es su
 * dirección de verdad. Solo en producción: en desarrollo `localhost:3000/s/…` es la
 * forma normal de entrar.
 */
function subdominioCorrecto(request: NextRequest, sub: string | null): URL | null {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  if (host !== ROOT && !host.endsWith(`.${ROOT}`)) return null;
  const m = /^\/s\/([^/]+)(\/.*)?$/.exec(request.nextUrl.pathname);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  if (slug === sub || RESERVED.has(slug) || slug.includes('.')) return null;
  const destino = new URL(`https://${slug}.${ROOT}${m[2] ?? '/'}`);
  destino.search = request.nextUrl.search;
  return destino;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const sub = subdomainOf(host);

  const otro = subdominioCorrecto(request, sub);
  // 307 y no 308: un POST (una server action) tiene que seguir siendo POST.
  if (otro) return NextResponse.redirect(otro, 307);

  if (!sub) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (url.pathname.startsWith('/s/')) return NextResponse.next();
  url.pathname = `/s/${sub}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
