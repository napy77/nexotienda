'use server';

import { nexopos } from '@/lib/nexopos';
import type { NewOrder, TownSearchHit } from '@/lib/nexopos/types';

export async function searchTownAction(
  townSlug: string,
  query: string,
): Promise<TownSearchHit[]> {
  const result = await nexopos.searchTown(townSlug, query);
  // TODO(D12): registrar las búsquedas sin resultado — son señal de demanda para el
  // comercio, para el mayorista y para el equipo comercial de Nexo B2B.
  return result.hits;
}

export async function placeOrderAction(input: NewOrder): Promise<
  { ok: true; code: string } | { ok: false; error: string }
> {
  try {
    const order = await nexopos.createOrder(input);
    return { ok: true, code: order.code };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No pudimos registrar el pedido',
    };
  }
}
