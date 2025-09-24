// src/db/mysql.ts
import mysql from "mysql2/promise";

/**
 * Prefer discrete env vars (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME)
 * but also support DATABASE_URL as a fallback.
 * Make sure you load env first in your entrypoint:
 *   import 'dotenv/config'
 */

const hasDiscrete =
  !!process.env.DB_HOST &&
  !!process.env.DB_USER &&
  !!process.env.DB_NAME; // password/port optional

const hasUrl = !!process.env.DATABASE_URL;

if (!hasDiscrete && !hasUrl) {
  throw new Error(
    "No DB config found. Set either DATABASE_URL or DB_HOST/DB_USER/DB_NAME (plus DB_PASSWORD/DB_PORT)."
  );
}

// Enable namedPlaceholders so we can use :param in queries
export const pool = hasDiscrete
  ? mysql.createPool({
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME!,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    })
  : mysql.createPool({
      uri: process.env.DATABASE_URL!, // e.g. mysql://user:pass@host:3306/db?timezone=Z
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });

export async function withTx<T>(fn: (cxn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const cxn = await pool.getConnection();
  try {
    await cxn.beginTransaction();
    const out = await fn(cxn);
    await cxn.commit();
    return out;
  } catch (e) {
    await cxn.rollback();
    throw e;
  } finally {
    cxn.release();
  }
}


