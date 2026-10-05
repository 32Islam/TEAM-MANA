import { healthCheckDb } from '../server/turso';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await healthCheckDb();
    res.status(200).json({ status: 'ok', database: 'turso', time: new Date().toISOString() });
  } catch (error: any) {
    console.error('[Turso] health check failed:', error);
    res.status(500).json({
      status: 'error',
      database: 'turso',
      error: process.env.NODE_ENV === 'development' ? String(error?.message || error) : 'Database unavailable',
    });
  }
}
