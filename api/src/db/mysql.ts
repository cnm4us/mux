import mysql from 'mysql2/promise';
import type { FieldPacket } from 'mysql2/promise';
import { config } from '../config/index.js';

export const pool = mysql.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

// Lightweight typed wrapper that avoids mysql2's generic constraints noise in callers.
// We don't pass a generic into pool.query; instead we cast rows on return.
export async function query<T = any>(sql: string, params?: any): Promise<[T[], FieldPacket[]]> {
  const [rows, fields] = await pool.query(sql, params);
  return [rows as T[], fields as FieldPacket[]];
}
