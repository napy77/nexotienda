import { notFound } from 'next/navigation';
import { BookMarked } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { libretaDeLaSesion } from '@/lib/libreta';
import { money, longDate } from '@/lib/format';
import { ContactButton, StoreShell } from '@/components/StoreShell';
import { PayAccount } from '@/components/PayAccount';
import { EntrarEnEstaPantalla } from '@/components/EntrarEnEstaPantalla';

/**
 * La libreta CON ESTE COMERCIO.
 *
 * No existe una libreta "del pueblo": cada comercio es el acreedor de la suya, con su
 * propia fecha de cierre y su propio disponible (P1, D27). El total del pueblo lo
 * calcula ClubPay para mostrárselo al deudor, y nada más (P3).
 *
 * ---
 *
 * **Esta pantalla contesta dos preguntas y no más: cuánto debo y cuánto puedo
 * cargar.** El detalle —la pila de resúmenes cerrados, los movimientos de cada uno—
 * no está acá a propósito.
 *
 * La libreta online requiere ClubPay, así que **todo el que puede abrir esta pantalla
 * ya tiene la pila en la app**. Repetirla no sería mostrar más: sería mostrarle lo
 * mismo dos veces a la misma persona, con dos implementaciones que pueden no
 * coincidir. Basta que difieran en qué período está abierto para que alguien vea dos
 * deudas distintas del mismo comercio, que es lo peor que puede pasar acá (P6). Y de
 * paso, una sesión robada en la tienda sirve para comprar —acotado, y el comerciante
 * lo ve— y no para pasearse por la historia financiera de alguien.
 */
export default async function LibretaPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();
  const { account } = await libretaDeLaSesion(store);

  if (!account) {
    return (
      <StoreShell store={store}>
        <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-800">
            Acá no tenés la libreta abierta
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Si ya tenés libreta con {store.name}, entrá desde ClubPay, en Mis comercios.
            Si todavía no, se abre en el mostrador: hablando con ellos y con tu documento.
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            Igual podés comprar: elegís pagar al recibirlo y listo.
          </p>

          {/*
            El caso de la computadora de casa: la tienda en una pantalla y ClubPay en
            la otra. Va acá y no en el checkout porque es donde alguien llega cuando
            busca su libreta y no la encuentra.
          */}
          <EntrarEnEstaPantalla store={store} />

          <div className="mt-5 flex justify-center">
            <ContactButton store={store} />
          </div>
        </div>
      </StoreShell>
    );
  }

  const canPayOnline = store.acceptedPayments.includes('online');
  const debe = account.balanceCents;

  return (
    <StoreShell store={store}>
      <h1 className="mb-1 text-2xl font-black tracking-tight text-neutral-900">
        Tu libreta con {store.name}
      </h1>
      {account.closingDay !== undefined && (
        <p className="mb-6 text-sm text-neutral-600">
          Cierra el {account.closingDay} de cada mes
          {/* "Cierra el 10" sin "vence el 20" es media frase. */}
          {account.dueDay !== undefined && ` y vence el ${account.dueDay}`}.
        </p>
      )}

      {/*
        Cuánto debe. Sale del saldo del libro y no de sumar resúmenes: esa suma deja
        afuera el período abierto y a quien compró ayer le diría de menos. Si el dato
        no viniera, no se muestra la línea — un número equivocado con autoridad es
        peor que no tener número (P6).
      */}
      {debe !== undefined && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
            {debe > 0 ? `Le debés a ${store.name}` : 'Tu cuenta está al día'}
          </p>
          <p className="mt-1 text-3xl font-black text-neutral-900">{money(debe)}</p>
          {debe > 0 && account.currentPeriod?.dueDate && (
            <p className="mt-1 text-sm text-neutral-600">
              El período en curso vence el {longDate(account.currentPeriod.dueDate)}.
            </p>
          )}
          {debe > 0 && canPayOnline && (
            <div className="mt-4">
              {/* Importe libre contra la cuenta, no contra un resumen elegido (D31). */}
              <PayAccount
                storeId={store.id}
                storeSlug={store.slug}
                storeName={store.name}
                accountId={account.accountId}
                owedCents={debe}
              />
            </div>
          )}
        </div>
      )}

      {/*
        Sin límite es el default y el caso más común: ahí no se muestra ninguna línea
        de disponible. Ponerle "$0" sería exactamente al revés de la verdad, y decir
        "sin límite" suena a premio cuando es solo cómo funciona el cuaderno (D32).
      */}
      {account.availableCents !== null && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold tracking-wider text-emerald-800 uppercase">
            Disponible para comprar
          </p>
          <p className="mt-1 text-3xl font-black text-emerald-900">
            {money(account.availableCents)}
          </p>
        </div>
      )}

      {account.creditPaused && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">
            Para seguir comprando en la libreta, hablá con {store.name}.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Podés seguir comprando pagando de otra forma.
          </p>
          <div className="mt-3">
            <ContactButton store={store} />
          </div>
        </div>
      )}

      <p className="mb-8 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">
        El detalle de tus compras y tus pagos con {store.name} está en ClubPay, en Mis
        comercios. Acá ves lo que necesitás para comprar.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <ContactButton store={store} />
      </div>
    </StoreShell>
  );
}
