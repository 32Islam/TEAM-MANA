import {
  ensureSchema,
  getCurrentTournament,
  saveCurrentTournament,
} from '../../server/turso';

export const config = {
  runtime: 'nodejs',
};

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const tournament = await getCurrentTournament();

      if (!tournament) {
        return res.status(200).json({
          config: null,
          savedMatches: [],
          lastUpdated: 0,
          tournamentId: null,
        });
      }

      return res.status(200).json({
        config: tournament.config,
        savedMatches: tournament.matches,
        lastUpdated: new Date(tournament.updatedAt).getTime(),
        tournamentId: tournament.id,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const result = await saveCurrentTournament({
        config: body.config,
        savedMatches: body.savedMatches,
        lastUpdated: body.lastUpdated,
      });

      return res.status(200).json({
        success: true,
        tournamentId: result.id,
        lastUpdated: result.lastUpdated,
        matchesCount: result.matchesCount,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[Turso] /api/tournament/state failed:', error);
    return res.status(500).json({
      error: 'Database operation failed',
      details: process.env.NODE_ENV === 'development' ? String(error?.message || error) : undefined,
    });
  }
}
