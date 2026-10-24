import { Pool, PoolClient, QueryResultRow } from 'pg';

const globalPool = globalThis as unknown as { condoveryPool?: Pool };
export const pool = globalPool.condoveryPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: Math.max(1,Math.min(12,Number(process.env.DATABASE_POOL_MAX||5))),
  connectionTimeoutMillis:5000,
  statement_timeout:10000,
  query_timeout:12000,
  idleTimeoutMillis: 30000
});
if (process.env.NODE_ENV !== 'production') globalPool.condoveryPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return pool.query<T>(sql, params);
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
