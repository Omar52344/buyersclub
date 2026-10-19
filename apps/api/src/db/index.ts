import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

export const sqlClient = postgres(config.DATABASE_URL, {
  max: 10,
  onnotice: () => undefined,
});

export const db = drizzle(sqlClient, { schema });
