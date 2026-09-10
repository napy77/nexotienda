import { notFound } from 'next/navigation';
import { BookMarked } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { getAccountId } from '@/lib/session';
import { money, longDate, shortDate } from '@/lib/format';
import { ContactButton, StoreShell } from '@/components/StoreShell';
import { PayAccount } from '@/components/PayAccount';

/**
 * La libreta CON ESTE COMERCIO.
 *
 * No existe una libreta "del pueblo": cada comercio es el acreedor de la suya, con su
 * propia fecha de cierre y su propio disponible (P1, D27). El total del pueblo lo
 * calcula ClubPay para mostrárselo al deudor, y nada más (P3).
 */
export default async function LibretaPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();

  const accountId = await getAccountId(store.slug);
  const account = accountId ? await nexopos.getAccount(store.id, accountId) : null;

  if (!account) {
    return (
      <StoreShell store={store}>
        <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-800">
            No tenés libreta con {store.name}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            La libreta se abre en el mostrador, hablando con ellos y con tu documento. Después
            la vinculás desde ClubPay y la ves acá.
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            Igual podés comprar: elegís pagar al recibirlo y listo.
          </p>
          <div className="mt-5 flex justify-center">
            <ContactButton store={store} />
          </div>
        </div>
      </StoreShell>
    );
  }

  // El período abierto nunca se mezcla ni se suma con los resúmenes cerrados (D28).
  const open = account.statements.find((st) => st.status === 'abierto');
  const closed = account.statements.filter((st) => st.status !== 'abierto');
  const owedCents = closed.reduce((a, st) => a + (st.totalCents - st.paidCents), 0);

  // Los movimientos no vienen anidados: se piden aparte.
  const entriesByStatement = Object.fromEntries(
    await Promise.all(
      account.statements.map(async (st) => [
        st.statementId,
        await nexopos.getStatementEntries(store.id, account.accountId, st.statementId),
      ]),
    ),
  ) as Record<string, Awaited<ReturnType<typeof nexopos.getStatementEntries>>>;

  const canPayOnline = store.acceptedPayments.includes('online');

  return (
    <StoreShell store={store}>
      <h1 className="mb-1 text-2xl font-black tracking-tight text-neutral-900">
        Tu libreta con {store.name}
      </h1>
      <p className="mb-6 text-sm text-neutral-600">Cierra el {account.closingDay} de cada mes.</p>

      {/*
        Sin límite es el default y el caso más común: ahí no se muestra ninguna línea
        de disponible. Ponerle "$0" sería exactamente al revés de la verdad, y decir
        "sin límite" suena a premio cuando es solo cómo funciona el cuaderno.
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

      {closed.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold tracking-wide text-neutral-500 uppercase">
              Resúmenes cerrados
            </h2>
            {canPayOnline && owedCents > 0 && (
              <PayAccount
                storeId={store.id}
                storeSlug={store.slug}
                storeName={store.name}
                accountId={account.accountId}
                owedCents={owedCents}
              />
            )}
          </div>

          <div className="space-y-3">
            {closed.map((st) => {
              const pending = st.totalCents - st.paidCents;
              const entries = entriesByStatement[st.statementId] ?? [];
              return (
                <article
                  key={st.statementId}
                  className="rounded-xl border border-neutral-200 bg-white"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-4">
                    <div>
                      {/* El label lo calcula NexoPOS y se muestra tal cual. */}
                      <p className="text-sm font-bold text-neutral-900">{st.label}</p>
                      <p className="text-xs text-neutral-500">
                        {st.closedAt && `Cerrado el ${longDate(st.closedAt)}`}
                        {st.dueDate && ` · vence el ${longDate(st.dueDate)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">
                        {st.status === 'pagado'
                          ? 'Pagado'
                          : st.paidCents > 0
                            ? `Pagaste ${money(st.paidCents)} · queda`
                            : 'Queda por pagar'}
                      </p>
                      <p className="text-lg font-black text-neutral-900">
                        {money(st.status === 'pagado' ? st.totalCents : pending)}
                      </p>
                    </div>
                  </header>

                  {entries.length > 0 ? (
                    <ul className="divide-y divide-neutral-100">
                      {entries.map((e) => (
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
                  ) : (
                    // P5: si los movimientos no llegaron, se dice; no se muestra vacío
                    // como si el resumen no tuviera nada.
                    <p className="px-4 py-3 text-xs text-neutral-500">
                      No pudimos traer el detalle de este resumen. Consultalo con{' '}
                      {store.name}.
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {!canPayOnline && owedCents > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-100 p-4">
              <p className="text-xs text-neutral-600">
                {store.name} todavía no cobra online. Arreglalo directamente con ellos.
              </p>
              <ContactButton store={store} />
            </div>
          )}
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
              {(entriesByStatement[open.statementId] ?? []).map((e) => (
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
