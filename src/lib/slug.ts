/**
 * Reglas del slug: lo que va antes del punto en `supersol.nexotienda.app`.
 *
 * El comerciante lo elige en su perfil de NexoPOS. NexoTienda no lo valida —cuando
 * llega acá ya está decidido— pero estas reglas viven de este lado porque salen de
 * cómo está armada la infraestructura, y NexoPOS las tiene que aplicar igual.
 */

/**
 * Un solo espacio de nombres para TODO lo que cuelga del dominio.
 *
 * Es el punto que más fácil se pasa por alto: los comercios y las regiones comparten
 * subdominio. Si un comercio pudiera tomar `morrison`, se quedaría con la página del
 * pueblo. La unicidad se valida contra los tres conjuntos juntos.
 */
export const RESERVED_SLUGS = new Set([
  // Infraestructura
  'www', 'api', 'admin', 'app', 'cdn', 'assets', 'static', 'mail', 'smtp', 'ftp',
  // La delegación del certificado. Tomarlos rompería la renovación.
  'acme', 'acme-ns', '_acme-challenge',
  // Reservados para uso futuro
  'ayuda', 'soporte', 'blog', 'panel', 'cuenta', 'pagos', 'status',
]);

export interface SlugCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Valida la forma. La unicidad la resuelve NexoPOS contra su base.
 *
 * El límite de un solo nivel no es una preferencia: el certificado es
 * `*.nexotienda.app`, y un comodín cubre **una** etiqueta. `a.b.nexotienda.app` no
 * está cubierto y daría error de certificado.
 */
export function checkSlugShape(slug: string): SlugCheck {
  if (!slug) return { ok: false, reason: 'Poné un nombre para la dirección.' };
  if (slug.includes('.')) {
    return {
      ok: false,
      reason: 'No puede llevar puntos: el certificado cubre un solo nivel.',
    };
  }
  if (slug.length < 3) return { ok: false, reason: 'Muy corto: mínimo 3 letras.' };
  if (slug.length > 40) return { ok: false, reason: 'Muy largo: máximo 40 letras.' };
  if (!/^[a-z0-9]/.test(slug)) return { ok: false, reason: 'Tiene que empezar con letra o número.' };
  if (!/[a-z0-9]$/.test(slug)) return { ok: false, reason: 'Tiene que terminar con letra o número.' };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, reason: 'Solo minúsculas, números y guiones. Sin espacios ni acentos.' };
  }
  if (slug.includes('--')) return { ok: false, reason: 'No puede llevar dos guiones seguidos.' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'Ese nombre está reservado.' };
  return { ok: true };
}

/** La propuesta que se le muestra al comerciante para que la acepte o la cambie. */
export function suggestSlug(storeName: string): string {
  return storeName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
}
