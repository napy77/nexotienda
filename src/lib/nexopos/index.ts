import { client } from './client';
import { fixtures } from './fixtures';
import type { NexoPosPort } from './types';

/**
 * Elegir el adapter es lo único que cambia el día que exista la API de NexoPOS:
 * se setea NEXOPOS_API_URL y listo. Ningún componente sabe de esto.
 */
export const nexopos: NexoPosPort = process.env.NEXOPOS_API_URL ? client : fixtures;

export * from './types';
