import Link from 'next/link';
import {
  BadgeCheck,
  BookOpenCheck,
  LayoutGrid,
  PackageCheck,
  Tag,
  Truck,
  Wallet,
} from 'lucide-react';
import { cantidad, money } from '@/lib/format';
import type { Campaign, MerchantAccount, Pasillo, Store } from '@/lib/nexopos/types';

/**
 * La barra de motivos para comprar acá.
 *
 * Dos reglas.
 *
 * **La primera: siempre llena, nunca con un hueco.** Una barra de tres con dos
 * tarjetas y un vacío a la derecha no se lee como "este comercio no reparte", se lee
 * como que la página está a medio cargar. Así que se arma una lista de candidatas y
 * se toman las que entran.
 *
 * **La segunda, y es la que manda: solo entra lo que se puede respaldar.** Rellenar
 * con "la mejor calidad" o "atención personalizada" es gratis, y por eso no vale
 * nada; acá encima es peligroso, porque en un pueblo el que lee conoce al del
 * mostrador y sabe si es cierto. Todas las de abajo salen de un dato del comercio:
 * sus franjas de reparto, sus campañas vigentes, sus góndolas contadas, sus medios de
 * pago. Si un comercio no da para tres, muestra dos y no pasa nada — antes que
 * inventar la tercera.
 *
 * Lo que tampoco hacemos es prometer un tiempo (D20). El prototipo decía "retirá en
 * 15 min": una promesa nuestra sobre el trabajo de otro, y el día que hay cola
 * quedamos mal los dos.
 */
type Prop = {
  key: string;
  icon: typeof Truck;
  tono: string;
  title: string;
  text: string;
  href?: string;
};

export function ValueProps({
  store,
  account,
  campaigns = [],
  pasillos = [],
}: {
  store: Store;
  account: MerchantAccount | null;
  campaigns?: Campaign[];
  pasillos?: Pasillo[];
}) {
  const reparto = store.slots.filter((s) => s.kind === 'reparto');
  const retiro = store.slots.filter((s) => s.kind === 'retiro');
  const props: Prop[] = [];

  /*
    El camión sale de tener franjas de reparto, no de tener envío gratis. Estaban
    atados, y el que reparte cobrando siempre —que es la mayoría— se quedaba sin
    camión y sin que la tienda dijera en ningún lado que lleva a domicilio.
  */
  if (reparto.length > 0) {
    const franjas = reparto.map((s) => s.label.replace(/^Reparto /, '')).join(' o ');
    props.push({
      key: 'reparto',
      icon: Truck,
      tono: 'border-amber-200/60 bg-amber-50 text-amber-700',
      title: 'Te lo llevamos a tu casa',
      text:
        store.freeDeliveryOverCents !== undefined
          ? `Sin cargo desde ${money(store.freeDeliveryOverCents)}. ${franjas}.`
          : `${franjas}. En ${store.town} y la zona que reparte ${store.name}.`,
    });
  }

  if (retiro.length > 0 || reparto.length === 0) {
    props.push({
      key: 'retiro',
      icon: PackageCheck,
      tono: 'border-blue-200/60 bg-blue-50 text-blue-700',
      title: 'Encargá y pasá a retirarlo',
      text: 'Te avisamos cuando esté listo, sin hacer cola.',
    });
  }

  if (store.allowsCredit) {
    props.push({
      key: 'libreta',
      icon: BookOpenCheck,
      tono: 'border-emerald-200/60 bg-emerald-50 text-emerald-700',
      title: account ? 'Tu libreta con este comercio' : 'Acá se puede comprar en la libreta',
      text: !account
        ? 'El fiado de siempre, anotado y a la vista. Se abre en el mostrador.'
        : account.availableCents !== null
          ? // "Disponible", nunca "tu límite" (D32). Sin límite no se muestra: "sin
            // límite" suena a premio y es solo cómo funciona el cuaderno.
            `Disponible ${money(account.availableCents)}. Cierra el ${account.closingDay}.`
          : `Cierra el ${account.closingDay} de cada mes.`,
      href: `/s/${store.slug}/libreta`,
    });
  }

  // --- De acá para abajo, relleno. Todo contado, nada adjetivado. ---

  const enOferta = new Set(campaigns.flatMap((c) => c.productIds)).size;
  if (enOferta > 0) {
    props.push({
      key: 'ofertas',
      icon: Tag,
      tono: 'border-red-200/60 bg-red-50 text-red-700',
      title: `${cantidad(enOferta)} ${enOferta === 1 ? 'producto en oferta' : 'productos en oferta'}`,
      text:
        campaigns.length === 1
          ? `${campaigns[0].name}, mientras dure.`
          : `En ${campaigns.length} promociones que están corriendo ahora.`,
    });
  }

  const productos = pasillos.reduce((a, p) => a + (p.productCount ?? 0), 0);
  if (productos >= 60 && pasillos.length >= 2) {
    props.push({
      key: 'catalogo',
      icon: LayoutGrid,
      tono: 'border-indigo-200/60 bg-indigo-50 text-indigo-700',
      title: `${cantidad(productos)} productos cargados`,
      text: `Repartidos en ${pasillos.length} góndolas. Buscá por nombre o entrá por la que quieras.`,
    });
  }

  const otrosMedios = store.acceptedPayments.filter(
    (m) => m === 'online' || m === 'transferencia',
  );
  if (otrosMedios.length > 0) {
    props.push({
      key: 'pagos',
      icon: Wallet,
      tono: 'border-violet-200/60 bg-violet-50 text-violet-700',
      title: 'Pagás como te quede cómodo',
      text:
        otrosMedios.length === 2
          ? 'Efectivo al recibirlo, transferencia o tarjeta.'
          : otrosMedios[0] === 'transferencia'
            ? 'Efectivo al recibirlo o por transferencia.'
            : 'Efectivo al recibirlo o con tarjeta.',
    });
  }

  if (store.verified) {
    props.push({
      key: 'verificado',
      icon: BadgeCheck,
      tono: 'border-sky-200/60 bg-sky-50 text-sky-700',
      title: 'Es la tienda del comercio',
      text: `${store.name} la administra desde su propio sistema. Los precios y el stock son los suyos.`,
    });
  }

  const visibles = props.slice(0, 3);
  if (visibles.length === 0) return null;

  // La grilla se acomoda a lo que hay: dos tarjetas ocupan la barra entera en vez de
  // dejar un tercio en blanco.
  const columnas = visibles.length === 1 ? '' : visibles.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  return (
    <div
      className={`mb-6 grid grid-cols-1 divide-y divide-neutral-100 rounded-lg border border-neutral-200/90 bg-white p-4 shadow-xs sm:p-5 md:divide-x md:divide-y-0 ${columnas}`}
    >
      {visibles.map((p, i) => {
        const Icon = p.icon;
        const cuerpo = (
          <>
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform ${p.tono} ${p.href ? 'group-hover:scale-105' : ''}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm leading-tight font-bold text-neutral-900">{p.title}</h4>
              <p className="mt-0.5 text-xs text-neutral-600">{p.text}</p>
            </div>
          </>
        );

        const espaciado = `flex items-center gap-4 ${i === 0 ? 'pt-2 md:pt-0' : 'pt-3 md:pt-0 md:pl-6'}`;

        return p.href ? (
          <Link
            key={p.key}
            href={p.href}
            className={`group -m-2 rounded-lg p-2 transition-colors hover:bg-neutral-50/70 ${espaciado}`}
          >
            {cuerpo}
          </Link>
        ) : (
          <div key={p.key} className={espaciado}>
            {cuerpo}
          </div>
        );
      })}
    </div>
  );
}
