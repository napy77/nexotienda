import { notFound } from 'next/navigation';
import { nexopos } from '@/lib/nexopos';
import { libretaDeLaSesion } from '@/lib/libreta';
import { Checkout } from '@/components/Checkout';
import { StoreShell } from '@/components/StoreShell';

export default async function CarritoPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();

  // Lo normal es no tener cuenta: se compra y se paga, sin identificarse. Con
  // cuenta no quiere decir con libreta: eso lo dice `account.creditEnabled`.
  const { account } = await libretaDeLaSesion(store);

  return (
    <StoreShell store={store}>
      <h1 className="mb-5 text-2xl font-black tracking-tight text-neutral-900">Tu pedido</h1>
      <Checkout
        store={store}
        account={account}
        // Se lee acá, en el servidor y en cada pedido, y no con `NEXT_PUBLIC_`: así
        // cambiarla no obliga a recompilar.
        clubpayWeb={process.env.CLUBPAY_WEB_URL || 'https://www.clubpay.com.ar'}
      />
    </StoreShell>
  );
}
