import { drizzle } from 'drizzle-orm/node-postgres';
import { pool, poolUsers, poolSiif, poolChat, safeQuery, safeUsersQuery, safeSiifQuery, safeChatQuery } from '@shared/db';
import * as schema from './schema/index.js';

/**
 * Drizzle ORM client wired directly to the shared PostgreSQL pool.
 * Fully typed with synchronized schemas for users, schools_IERN, and modified_siif_utilization.
 */
export const db = drizzle(pool, { schema });

export {
  pool,
  poolUsers,
  poolSiif,
  poolChat,
  safeQuery,
  safeUsersQuery,
  safeSiifQuery,
  safeChatQuery,
  schema
};

export default db;
