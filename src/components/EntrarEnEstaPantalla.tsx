'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Loader2 } from 'lucide-react';
import type { Store } from '@/lib/nexopos/types';
import {
  abrirEmparejamientoAction,
  consultarEmparejamientoAction,
} from '@/app/actions';

/**
 * Abrir la libreta en la computadora, con ClubPay en el teléfono.
 *
 * Nadie escanea la pantalla de su propia compu con la compu, así que el handoff de la
 * app no sirve acá: abre la tienda *en el teléfono*.
 *
 * **Es un código corto y no un QR**, por dos motivos. Uno es de costo: el QR necesita
 * trabajo de cámara del lado de ClubPay que hoy solo existe para cobrar. El otro es
 * mejor: **un código que hay que leer de tu propia pantalla no se reenvía.** Una
 * imagen de QR sí, y ahí alguien te hace abrir tu libreta en la pantalla de otro. Para
 * tipear estas cinco letras hay que estar mirando esta computadora.
 *
 * **Esta dirección no es un OTP dado vuelta: es otro mecanismo.** El código nace en
 * el aparato que pide entrar y se consume en el que ya tiene la sesión, que es cómo
 * se entra a Netflix o a Spotify en un televisor. Al revés sería una contraseña de un
 * solo uso, y los OTP son la credencial más robada que existe: el fraude del código
 * de WhatsApp y el del banco que "te manda un código" son todos el mismo, y funcionan
 * porque la gente está entrenada para dictar un código que le llegó.
 *
 * La diferencia que decide es **dónde puede intervenir el defensor**. Así, el ataque
 * pasa por una pantalla de ClubPay que puede nombrar el comercio y preguntar "si no
 * fuiste vos, no confirmes". Al revés, en el momento en que alguien dicta el código
 * la app no participa: no hay pantalla donde poner nada.
 *
 * El `requestId` nunca llega acá: vive en una cookie `httpOnly`. Aunque alguien
 * aprobara un pedido ajeno, solo el navegador que lo abrió puede canjearlo.
 */
type Estado =
  | { k: 'inicio' }
  | { k: 'abriendo' }
  | { k: 'esperando'; code: string; hasta: number }
  | { k: 'vencido' }
  | { k: 'sin_soporte' };

export function EntrarEnEstaPantalla({ store }: { store: Store }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ k: 'inicio' });

  async function empezar() {
    setEstado({ k: 'abriendo' });
    const par = await abrirEmparejamientoAction(store.id, store.slug);
    if (!par) {
      setEstado({ k: 'sin_soporte' });
      return;
    }
    // Si la fecha no viene o no se entiende, cinco minutos, que es lo acordado.
    const hasta = Date.parse(par.expiresAt ?? '') || Date.now() + 5 * 60_000;
    setEstado({ k: 'esperando', code: par.code, hasta });
  }

  useEffect(() => {
    if (estado.k !== 'esperando') return;
    const hasta = estado.hasta;
    let vivo = true;
    const t = setInterval(async () => {
      /*
        **El sondeo tiene que terminar.** Antes no terminaba nunca: si la persona se
        iba del escritorio, o si el salto de atrás fallaba —un error de red o un 502
        vuelven como "pendiente", que es lo mismo que "todavía no confirmó"— la
        pantalla giraba para siempre. Es el mismo error que NexoPOS corrigió del otro
        lado: un problema de atrás presentado como "todo bien, seguí esperando".

        El código vence igual a los cinco minutos, así que el reloj es el límite que
        ya existía y nadie estaba mirando.
      */
      if (Date.now() > hasta) {
        clearInterval(t);
        setEstado({ k: 'vencido' });
        return;
      }
      const r = await consultarEmparejamientoAction(store.id, store.slug);
      if (!vivo || r === 'pendiente') return;
      clearInterval(t);
      if (r === 'listo') router.refresh();
      else setEstado({ k: 'vencido' });
    }, 3000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [estado, store.id, store.slug, router]);

  if (estado.k === 'sin_soporte') {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        Por ahora la libreta se abre desde el teléfono: entrá a ClubPay, Mis comercios,{' '}
        {store.name}, y tocá <span className="font-semibold">Ir a la tienda</span>.
      </p>
    );
  }

  if (estado.k === 'esperando') {
    return (
      <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="text-sm text-neutral-700">
          Abrí <span className="font-semibold">ClubPay</span> en tu teléfono → Mis
          comercios → {store.name} → <span className="font-semibold">Entrar en otra
          pantalla</span>, y escribí este código:
        </p>
        <p className="my-4 text-center font-mono text-4xl font-black tracking-[0.3em] text-neutral-900">
          {estado.code}
        </p>
        <p className="flex items-center justify-center gap-2 text-xs text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Esperando que lo confirmes en el teléfono. El código dura cinco minutos.
        </p>
      </div>
    );
  }

  if (estado.k === 'vencido') {
    return (
      <div className="mt-5">
        <p className="mb-3 text-sm text-neutral-600">
          El código venció. Son tres minutos para que no quede dando vueltas.
        </p>
        <button
          onClick={empezar}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
        >
          Pedir otro
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={empezar}
      disabled={estado.k === 'abriendo'}
      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
    >
      <Monitor className="h-4 w-4" />
      {estado.k === 'abriendo' ? 'Pidiendo el código…' : 'Abrir mi libreta en esta pantalla'}
    </button>
  );
}
