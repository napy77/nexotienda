'use client';

import { useState } from 'react';

/**
 * Las fotos del producto.
 *
 * Tres formas, no una con huecos:
 *
 * - **Sin fotos**: "Sin foto". No un recuadro gris que parece que está cargando.
 * - **Una sola**: exactamente lo que había antes. Nada de una tira de miniaturas de
 *   un elemento, que es un control que promete que hay más cuando no hay más. Y una
 *   sola foto es el caso de todo lo que hace el comercio —la pizza, el pan—: la
 *   galería viene del catálogo maestro y eso el comercio no lo carga.
 * - **Varias**: la grande y las miniaturas debajo.
 *
 * **Una foto que no carga se saca de la lista.** Un hueco roto entre cuatro
 * miniaturas es peor que tres miniaturas. Si la que falla es la que se está mirando,
 * se pasa a la siguiente sola; si fallan todas, queda el "Sin foto" de siempre.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [rotas, setRotas] = useState<string[]>([]);
  const [elegida, setElegida] = useState(0);

  const fotos = images.filter((u) => !rotas.includes(u));
  const actual = fotos[Math.min(elegida, fotos.length - 1)];

  if (!actual) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-neutral-50 p-6 md:min-h-80">
        <span className="text-sm text-neutral-400">Sin foto</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-center rounded-lg bg-neutral-50 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={actual}
          alt={alt}
          onError={() => setRotas((r) => [...r, actual])}
          className="max-h-96 w-full object-contain"
        />
      </div>

      {fotos.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {fotos.map((foto, i) => (
            <button
              key={foto}
              onClick={() => setElegida(i)}
              aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
              aria-current={foto === actual}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-neutral-50 transition-colors ${
                foto === actual
                  ? 'border-blue-500'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto}
                alt=""
                onError={() => setRotas((r) => [...r, foto])}
                className="h-full w-full object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
