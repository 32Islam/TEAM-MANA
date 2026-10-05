import { createNewTournament } from '../../server/turso';

export const config = {
  runtime: 'nodejs',
};

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await createNewTournament(req.body?.config || null);
    return res.status(200).json({
      success: true,
      tournamentId: result.id,
      name: result.name,
      createdAt: result.createdAt,
      matchesCount: 0,
    });
  } catch (error: any) {
    console.error('[Turso] /api/tournament/reset failed:', error);
    return res.status(500).json({
      error: 'Could not create the new tournament',
      details: process.env.NODE_ENV === 'development' ? String(error?.message || error) : undefined,
    });
  }
}
