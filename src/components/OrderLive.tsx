'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { orderPulseAction } from '@/app/actions';

/**
 * Que la pantalla del pedido no haya que recargarla a mano.
 *
 * El comerciante acepta el pedido en NexoPOS y del otro lado hay alguien mirando el
 * teléfono. Si para enterarse hay que apretar F5, la mitad de la gente no se entera:
 * o no se le ocurre, o lo hace cada diez segundos, que es peor.
 *
 * Tres cosas que no son obvias:
 *
 * - **Con la pantalla tapada no se pregunta nada.** El teléfono se bloquea y queda en
 *   el bolsillo; preguntar cada quince segundos ahí es gastar batería y API al pedo.
 *   Lo que sí se hace es preguntar **en el momento exacto en que vuelve**, que es
 *   cuando la persona está mirando y es cuando importa.
 * - **Se pregunta barato y se refresca caro.** El latido devuelve cuatro campos; la
 *   página entera solo se rearma cuando algo cambió de verdad.
 * - **Después de un rato quieto, afloja.** Un pedido que lleva cinco minutos igual
 *   probablemente siga igual un rato más.
 *
 * Y sigue habiendo un botón: alguien va a querer apretar algo igual. Mejor que sea
 * este y no F5, que rearma toda la tienda.
 *
 * Esto es el parche hasta que lleguen los webhooks de NexoPOS.
 */
const ACTIVO = 15_000;
const TRANQUILO = 45_000;
const AFLOJA_DESPUES_DE = 5 * 60_000;

export function OrderLive({
  code,
  pulse,
  terminal,
}: {
  code: string;
  /** La huella de lo que está en pantalla. Si el servidor devuelve otra, se refresca. */
  pulse: string;
  /** Entregado o cancelado: no hay nada más que esperar. */
  terminal: boolean;
}) {
  const router = useRouter();
  const [mirando, setMirando] = useState(false);
  const ultimoCambio = useRef(Date.now());

  const revisar = useCallback(
    async (forzar = false) => {
      const ahora = await orderPulseAction(code);
      if (forzar || (ahora !== null && ahora !== pulse)) router.refresh();
    },
    [code, pulse, router],
  );

  useEffect(() => {
    ultimoCambio.current = Date.now();
  }, [pulse]);

  useEffect(() => {
    if (terminal) return;

    let vivo = true;
    let turno: ReturnType<typeof setTimeout>;

    function agendar() {
      clearTimeout(turno);
      const quieto = Date.now() - ultimoCambio.current > AFLOJA_DESPUES_DE;
      turno = setTimeout(async () => {
        if (!vivo) return;
        if (document.visibilityState === 'visible') await revisar();
        if (vivo) agendar();
      }, quieto ? TRANQUILO : ACTIVO);
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === 'visible') {
        void revisar();
        agendar();
      } else {
        clearTimeout(turno);
      }
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    agendar();

    return () => {
      vivo = false;
      clearTimeout(turno);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [revisar, terminal]);

  if (terminal) return null;

  async function aMano() {
    setMirando(true);
    try {
      await revisar(true);
    } finally {
      setMirando(false);
    }
  }

  return (
    <div className="mt-6 flex items-center gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
      Esta pantalla se actualiza sola
      <button
        onClick={aMano}
        disabled={mirando}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${mirando ? 'animate-spin' : ''}`} />
        Actualizar
      </button>
    </div>
  );
}
