import { notFound } from 'next/navigation';
import { BookMarked } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { money, longDate, shortDate } from '@/lib/format';
import { ContactButton, StoreShell } from '@/components/StoreShell';
import { PayPeriod } from '@/components/PayPeriod';

const DEMO_PERSON = 'per_7f3a91c2';

/**
 * La libreta CON ESTE COMERCIO.
 *
 * No existe una libreta "del pueblo": cada comercio es el acreedor de la suya, con su
 * propia fecha de cierre y su propio disponible (P1, D27). El total del pueblo se ve
 * en ClubPay, es del deudor, y es solo lectura — nunca un pagable (P3).
 */
export default async function LibretaPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();

  const account = await nexopos.getAccount(DEMO_PERSON, store.id);

  if (!account) {
    return (
      <StoreShell store={store}>
        <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-800">
            No tenés libreta con {store.name}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            La libreta se abre en el mostrador, hablando con ellos. Después la ves acá y en
            ClubPay.
          </p>
          <div className="mt-5 flex justify-center">
            <ContactButton store={store} />
          </div>
        </div>
      </StoreShell>
    );
  }

  // El período abierto nunca se mezcla ni se suma con los resúmenes cerrados (D28).
  const open = account.periods.find((p) => p.status === 'abierto');
  const closed = account.periods.filter((p) => p.status !== 'abierto');

  return (
    <StoreShell store={store}>
      <h1 className="mb-1 text-2xl font-black tracking-tight text-neutral-900">
        Tu libreta con {store.name}
      </h1>
      <p className="mb-6 text-sm text-neutral-600">
        Cierra el {account.closingDay} de cada mes.
      </p>

      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        {/* "Disponible", nunca "tu límite" (D32). */}
        <p className="text-xs font-bold tracking-wider text-emerald-800 uppercase">
          Disponible para comprar
        </p>
        <p className="mt-1 text-3xl font-black text-emerald-900">
          {money(account.availableCents)}
        </p>
        {account.creditPaused && (
          <div className="mt-3">
            <p className="text-sm text-emerald-900">
              Para seguir comprando en la libreta, hablá con {store.name}.
            </p>
            <div className="mt-2">
              <ContactButton store={store} />
            </div>
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-wide text-neutral-500 uppercase">
            Resúmenes cerrados
          </h2>
          <div className="space-y-3">
            {closed.map((p) => {
              const pending = p.totalCents - p.paidCents;
              return (
                <article key={p.id} className="rounded-xl border border-neutral-200 bg-white">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-4">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{p.label}</p>
                      {p.closedAt && (
                        <p className="text-xs text-neutral-500">
                          Cerrado el {longDate(p.closedAt)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">
                        {p.status === 'pagado'
                          ? 'Pagado'
                          : p.paidCents > 0
                            ? `Pagaste ${money(p.paidCents)} · queda`
                            : 'Queda por pagar'}
                      </p>
                      <p className="text-lg font-black text-neutral-900">
                        {money(p.status === 'pagado' ? p.totalCents : pending)}
                      </p>
                    </div>
                  </header>

                  <ul className="divide-y divide-neutral-100">
                    {p.entries.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="w-12 shrink-0 text-xs text-neutral-400">
                          {shortDate(e.date)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-neutral-700">
                          {e.description}
                          {e.receipt && (
                            <span className="ml-1 text-xs text-neutral-400">{e.receipt}</span>
                          )}
                        </span>
                        {e.disputed && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            En revisión
                          </span>
                        )}
                        <span className="font-medium text-neutral-900">
                          {money(e.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.status !== 'pagado' && (
                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 p-4">
                      <p className="text-xs text-neutral-500">
                        {store.acceptsOnlinePayment
                          ? `Podés pagarlo con ClubPay o en el mostrador de ${store.name}.`
                          : `Arreglalo directamente con ${store.name}.`}
                      </p>
                      {store.acceptsOnlinePayment ? (
                        <PayPeriod
                          personId={DEMO_PERSON}
                          storeId={store.id}
                          storeSlug={store.slug}
                          storeName={store.name}
                          periodId={p.id}
                          pendingCents={pending}
                        />
                      ) : (
                        <ContactButton store={store} />
                      )}
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {open && (
        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-neutral-500 uppercase">
            Lo que llevás este mes
          </h2>
          <article className="rounded-xl border border-dashed border-neutral-300 bg-white">
            <header className="flex items-center justify-between border-b border-neutral-100 p-4">
              <div>
                <p className="text-sm font-bold text-neutral-900">{open.label}</p>
                <p className="text-xs text-neutral-500">
                  Todavía abierto. Cierra el {account.closingDay}.
                </p>
              </div>
              <p className="text-lg font-black text-neutral-900">{money(open.totalCents)}</p>
            </header>
            <ul className="divide-y divide-neutral-100">
              {open.entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-12 shrink-0 text-xs text-neutral-400">
                    {shortDate(e.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-neutral-700">
                    {e.description}
                    <span className="ml-1 text-xs text-neutral-400">
                      {e.origin === 'tienda' ? 'tienda online' : 'mostrador'}
                    </span>
                  </span>
                  <span className="font-medium text-neutral-900">{money(e.amountCents)}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </StoreShell>
  );
}
