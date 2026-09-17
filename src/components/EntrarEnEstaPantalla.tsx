'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor } from 'lucide-react';
import type { Store } from '@/lib/nexopos/types';
import { canjearCodigoAction } from '@/app/actions';

/**
 * Abrir la libreta en la computadora, con ClubPay en el teléfono.
 *
 * Nadie escanea la pantalla de su propia compu con la compu, así que el handoff de la
 * app no sirve acá: abre la tienda *en el teléfono*.
 *
 * **El código lo genera la app y se tipea acá**, no al revés. Al revés, el ataque es
 * que alguien te muestre *su* código y te convenza de tipearlo en tu ClubPay — una
 * acción que se siente tan inofensiva como emparejar un televisor, y contra la que
 * nadie fue entrenado nunca. Así, el ataque necesita que le **dictes** un código que
 * tenés en el teléfono, que es contra lo que todos los bancos del país vienen
 * insistiendo hace diez años.
 *
 * No elimina el ataque. Lo muda a un terreno donde la gente ya está parada, y eso es
 * todo lo que se puede decir con honestidad de un mecanismo de emparejar pantallas.
 */
export function EntrarEnEstaPantalla({ store }: { store: Store }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [yendo, setYendo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setYendo(true);
    try {
      const r = await canjearCodigoAction(store.id, store.slug, code);
      if (r === 'listo') router.refresh();
      else setError(true);
    } finally {
      setYendo(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
      >
        <Monitor className="h-4 w-4" />
        Abrir mi libreta en esta pantalla
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <p className="text-left text-sm text-neutral-700">
        En tu teléfono, abrí <span className="font-semibold">ClubPay</span> → Mis
        comercios → {store.name} → <span className="font-semibold">Entrar en otra
        pantalla</span>. Escribí acá el código que te muestra:
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="•••••"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-label="Código de ClubPay"
        className="my-4 w-full rounded-lg border border-neutral-300 bg-white py-3 text-center font-mono text-3xl font-black tracking-[0.3em] uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      {error && (
        <p className="mb-3 text-sm font-medium text-red-700">
          Ese código no sirve. Puede estar mal tipeado o haber vencido — pedí uno nuevo
          en ClubPay.
        </p>
      )}

      <button
        type="submit"
        disabled={yendo || code.trim().length < 4}
        className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
      >
        {yendo ? 'Abriendo…' : 'Abrir mi libreta'}
      </button>

      <p className="mt-3 text-left text-xs text-neutral-500">
        Ese código es tuyo y abre tu libreta. Nadie del comercio ni de ClubPay te lo va
        a pedir: si alguien te lo pide, no se lo des.
      </p>
    </form>
  );
}
