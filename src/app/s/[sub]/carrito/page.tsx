import { notFound } from 'next/navigation';
import { nexopos } from '@/lib/nexopos';
import { getAccountId } from '@/lib/session';
import { Checkout } from '@/components/Checkout';
import { StoreShell } from '@/components/StoreShell';

export default async function CarritoPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();

  // Lo normal es no tener cuenta: se compra y se paga, sin identificarse.
  const accountId = await getAccountId(store.slug);
  const account = accountId ? await nexopos.getAccount(store.id, accountId) : null;

  return (
    <StoreShell store={store}>
      <h1 className="mb-5 text-2xl font-black tracking-tight text-neutral-900">Tu pedido</h1>
      <Checkout store={store} account={account} />
    </StoreShell>
  );
}
