'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Cuando algo se rompe del lado del servidor.
 *
 * Lo que aparecía antes era la pantalla por defecto de Next —"This page couldn't
 * load", en inglés, con un botón de recargar y nada más—. Le puede pasar a un
 * vecino que entró a comprar fideos, así que tiene que estar en castellano y ofrecer
 * lo único que sirve cuando la tienda no carga: el teléfono del comercio.
 *
 * El detalle técnico no se muestra: al comprador no le dice nada y puede filtrar
 * cómo está armado esto por dentro. Va al log del servidor, que es donde se mira.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[nexotienda]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6">
      <AlertTriangle className="h-10 w-10 text-amber-500" />

      <div>
        <h1 className="text-3xl font-black tracking-tight text-neutral-900">
          No pudimos cargar la tienda
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Es un problema nuestro, no tuyo. Probá de nuevo en un rato; si necesitás algo
          ahora, llamá al comercio directamente.
        </p>
      </div>

      <button
        onClick={reset}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
      >
        <RotateCcw className="h-4 w-4" />
        Probar de nuevo
      </button>

      {error.digest && (
        // Para poder encontrarlo en el log si alguien reporta el problema.
        <p className="font-mono text-xs text-neutral-400">ref {error.digest}</p>
      )}
    </main>
  );
}
