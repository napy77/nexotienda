import { notFound } from 'next/navigation';
import { nexopos } from '@/lib/nexopos';
import { Checkout } from '@/components/Checkout';
import { StoreShell } from '@/components/StoreShell';

/** Mientras no exista el handoff desde ClubPay, la persona de prueba es fija. */
const DEMO_PERSON = 'per_7f3a91c2';

export default async function CarritoPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();

  const account = await nexopos.getAccount(DEMO_PERSON, store.id);

  return (
    <StoreShell store={store}>
      <h1 className="mb-5 text-2xl font-black tracking-tight text-neutral-900">Tu pedido</h1>
      <Checkout store={store} account={account} />
    </StoreShell>
  );
}
