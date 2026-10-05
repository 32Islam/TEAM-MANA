import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createNewTournament, getCurrentTournament, healthCheckDb, saveCurrentTournament } from './server/turso';


async function startServer() {
  const app = express();
  const PORT = 3000;
  const STATE_FILE = path.join(process.cwd(), 'tournament_state.json');

  // CORS middleware for API routes
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // JSON body parser for tournament state sync & full-resolution stage background uploads (up to 50MB)
app.use(express.json({ limit: '50mb' }));



  // Persistent shared tournament state for multi-user / multi-device / OBS sync
  let sharedTournamentState = {
    config: null as any,
    savedMatches: [] as any[],
    lastUpdated: Date.now(),
  };

  // Active Admin Concurrency Session Lock
  let activeAdminLock = {
    deviceId: null as string | null,
    deviceName: null as string | null,
    acquiredAt: 0,
    lastHeartbeat: 0,
  };

  const LOCK_TIMEOUT_MS = 9000; // Lock expires if silent for >9s

  // Turso is the persistent source of truth.
// Do not load legacy tournament_state.json.
console.log('[Server] Skipping legacy tournament_state.json; using Turso as source of truth.');

  // Turso is the durable source of truth when configured. The JSON file is retained only
  // as a local-development fallback and as a one-time migration source.
  const tursoConfigured = Boolean(process.env.TURSO_DATABASE_URL);
  if (tursoConfigured) {
    try {
      const remote = await getCurrentTournament();
      if (remote) {
        sharedTournamentState = {
          config: remote.config || null,
          savedMatches: Array.isArray(remote.matches) ? remote.matches : [],
          lastUpdated: new Date(remote.updatedAt).getTime() || Date.now(),
        };
        console.log(`[Server] Loaded tournament from Turso (ID: ${remote.id}, Matches: ${sharedTournamentState.savedMatches.length})`);
      } else if (sharedTournamentState.config || sharedTournamentState.savedMatches.length > 0) {
        const migrated = await saveCurrentTournament({
          config: sharedTournamentState.config,
          savedMatches: sharedTournamentState.savedMatches,
          lastUpdated: sharedTournamentState.lastUpdated,
        });
        console.log(`[Server] Migrated legacy tournament_state.json into Turso (ID: ${migrated.id})`);
      }
    } catch (err) {
      console.error('[Server] Turso startup failed; continuing with local JSON fallback:', err);
    }
  }

  // Keep active Server-Sent Events (SSE) connections for zero-latency live OBS overlay sync
  const sseClients = new Set<express.Response>();

  function broadcastTournamentState() {
    const payload = `data: ${JSON.stringify({
      type: 'STATE_UPDATED',
      config: sharedTournamentState.config,
      savedMatches: sharedTournamentState.savedMatches,
      lastUpdated: sharedTournamentState.lastUpdated,
    })}\n\n`;

    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Periodic SSE keep-alive heartbeat every 15s to keep connections alive across proxies
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': heartbeat\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15000);

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    if (!tursoConfigured) {
      return res.json({ status: 'ok', database: 'local-file', time: new Date().toISOString() });
    }
    try {
      await healthCheckDb();
      return res.json({ status: 'ok', database: 'turso', time: new Date().toISOString() });
    } catch (err) {
      return res.status(500).json({ status: 'error', database: 'turso', time: new Date().toISOString() });
    }
  });

  // OBS Overlay Remote Test Trigger endpoint: broadcasts instant test signal to all OBS browser sources
  app.post('/api/tournament/obs-test', (req, res) => {
    const payload = req.body || {};
    const msg = `data: ${JSON.stringify({
      type: 'OBS_TEST_TRIGGER',
      ...payload,
    })}\n\n`;

    for (const client of sseClients) {
      try {
        client.write(msg);
      } catch {
        sseClients.delete(client);
      }
    }
    res.json({ success: true, timestamp: Date.now() });
  });

  // Server-Sent Events (SSE) endpoint for instant, 0ms latency sync with OBS Studio Browser Source & viewers
  app.get('/api/tournament/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send immediate snapshot on connect
    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      config: sharedTournamentState.config,
      savedMatches: sharedTournamentState.savedMatches,
      lastUpdated: sharedTournamentState.lastUpdated,
    })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Tournament shared state sync (keeps Admin Panel, OBS overlays, and remote viewers synchronized)
  app.get('/api/tournament/state', (req, res) => {
    // Explicit no-cache headers to prevent OBS Chromium CEF from caching stale standings
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.json(sharedTournamentState);
  });

  app.post('/api/tournament/state', async (req, res) => {
    const { config, savedMatches, lastUpdated } = req.body || {};
    if (config && typeof config === 'object') {
      sharedTournamentState.config = {
        ...(sharedTournamentState.config || {}),
        ...config,
        teamFlags: config.teamFlags !== undefined ? config.teamFlags : (sharedTournamentState.config?.teamFlags || {}),
      };
    }
    if (Array.isArray(savedMatches)) {
      sharedTournamentState.savedMatches = savedMatches;
    }
    sharedTournamentState.lastUpdated = lastUpdated || Date.now();

    if (tursoConfigured) {
      try {
        await saveCurrentTournament(sharedTournamentState);
      } catch (err) {
        console.error('[Server] Turso save failed; writing local fallback:', err);
        try {
          const tempFile = `${STATE_FILE}.tmp`;
          fs.writeFileSync(tempFile, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
          fs.renameSync(tempFile, STATE_FILE);
        } catch (fileErr) {
          console.error('[Server] Local fallback write also failed', fileErr);
        }
      }
    } else {
      try {
        const tempFile = `${STATE_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
        fs.renameSync(tempFile, STATE_FILE);
      } catch (err) {
        console.error('[Server] Failed to write tournament_state.json', err);
      }
    }

    // Instantly push to all active OBS Studio browser sources & connected viewers
    broadcastTournamentState();

    res.json({
      success: true,
      lastUpdated: sharedTournamentState.lastUpdated,
      matchesCount: sharedTournamentState.savedMatches.length,
    });
  });

  app.post('/api/tournament/reset', async (req, res) => {
    const nextConfig = req.body?.config && typeof req.body.config === 'object'
      ? req.body.config
      : sharedTournamentState.config;

    if (tursoConfigured) {
      try {
        const created = await createNewTournament(nextConfig);
        sharedTournamentState = {
          config: nextConfig || null,
          savedMatches: [],
          lastUpdated: Date.now(),
        };
        broadcastTournamentState();
        return res.json({
          success: true,
          tournamentId: created.id,
          lastUpdated: sharedTournamentState.lastUpdated,
          matchesCount: 0,
        });
      } catch (err) {
        console.error('[Server] Turso new tournament failed:', err);
        return res.status(500).json({ success: false, error: 'Could not create new tournament' });
      }
    }

    sharedTournamentState.savedMatches = [];
    sharedTournamentState.lastUpdated = Date.now();
    try {
      const tempFile = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
      fs.renameSync(tempFile, STATE_FILE);
    } catch (err) {
      console.error('[Server] Failed to reset tournament_state.json', err);
    }

    broadcastTournamentState();
    return res.json({ success: true, lastUpdated: sharedTournamentState.lastUpdated, matchesCount: 0 });
  });

  // Admin Single-Device Session Lock endpoints
  app.get('/api/admin/lock', (req, res) => {
    const now = Date.now();
    const isLockActive = Boolean(
      activeAdminLock.deviceId && now - activeAdminLock.lastHeartbeat < LOCK_TIMEOUT_MS
    );
    res.json({
      isLocked: isLockActive,
      activeSession: isLockActive ? activeAdminLock : null,
      serverTime: now,
    });
  });

  app.post('/api/admin/lock/acquire', (req, res) => {
    const { deviceId, deviceName, force } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const now = Date.now();
    const isLockActive = Boolean(
      activeAdminLock.deviceId &&
        activeAdminLock.deviceId !== deviceId &&
        now - activeAdminLock.lastHeartbeat < LOCK_TIMEOUT_MS
    );

    if (isLockActive && !force) {
      return res.json({
        success: false,
        reason: 'LOCKED_BY_ANOTHER_DEVICE',
        activeSession: activeAdminLock,
        lockedByOther: true,
      });
    }

    // Claim lock
    activeAdminLock = {
      deviceId,
      deviceName: deviceName || 'Admin Device',
      acquiredAt: activeAdminLock.deviceId === deviceId ? activeAdminLock.acquiredAt || now : now,
      lastHeartbeat: now,
    };

    res.json({
      success: true,
      activeSession: activeAdminLock,
      lockedByOther: false,
    });
  });

  app.post('/api/admin/lock/heartbeat', (req, res) => {
    const { deviceId, deviceName } = req.body || {};
    const now = Date.now();

    if (
      !activeAdminLock.deviceId ||
      activeAdminLock.deviceId === deviceId ||
      now - activeAdminLock.lastHeartbeat >= LOCK_TIMEOUT_MS
    ) {
      // Re-claim or refresh
      activeAdminLock = {
        deviceId,
        deviceName: deviceName || activeAdminLock.deviceName || 'Admin Device',
        acquiredAt: activeAdminLock.acquiredAt || now,
        lastHeartbeat: now,
      };
      return res.json({ success: true, activeSession: activeAdminLock, isOwner: true });
    }

    // Another device currently owns valid lock
    return res.json({
      success: false,
      isOwner: false,
      activeSession: activeAdminLock,
    });
  });

  app.post('/api/admin/lock/release', (req, res) => {
    const { deviceId } = req.body || {};
    if (activeAdminLock.deviceId === deviceId) {
      activeAdminLock = {
        deviceId: null,
        deviceName: null,
        acquiredAt: 0,
        lastHeartbeat: 0,
      };
    }
    res.json({ success: true });
  });

  // Dedicated PNG / Image logo upload endpoint
  app.post('/api/tournament/upload-logo', (req, res) => {
    try {
      const { dataUrl, fileName } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid dataUrl parameter' });
      }

      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = 'png';

      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        if (mimeType.includes('svg')) ext = 'svg';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('webp')) ext = 'webp';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(dataUrl, 'base64');
      }

      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const targetPath = path.join(publicDir, `uploaded-logo.${ext}`);
      fs.writeFileSync(targetPath, buffer);

      // Also ensure uploaded-logo.png always exists for consistent route resolution
      if (ext !== 'png') {
        const pngFallback = path.join(publicDir, 'uploaded-logo.png');
        try { fs.writeFileSync(pngFallback, buffer); } catch {}
      }

      const newLogoUrl = `/api/tournament/logo.png?v=${Date.now()}`;

      if (!sharedTournamentState.config) {
        sharedTournamentState.config = {};
      }
      sharedTournamentState.config.logoUrl = newLogoUrl;
      sharedTournamentState.lastUpdated = Date.now();

      try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
      } catch (e) {
        console.error('[Server] Failed to update tournament_state.json with new logo', e);
      }

      console.log(`[Server] Successfully saved uploaded logo (${buffer.length} bytes, file: ${fileName || 'unnamed'})`);
      broadcastTournamentState();
      return res.json({
        success: true,
        logoUrl: newLogoUrl,
        sizeBytes: buffer.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Server] Logo upload failed:', msg);
      return res.status(500).json({ error: 'Failed to process logo upload', details: msg });
    }
  });

  // Reset logo to default
  app.post('/api/tournament/reset-logo', (req, res) => {
    const uploadedPath = path.join(process.cwd(), 'public', 'uploaded-logo.png');
    if (fs.existsSync(uploadedPath)) {
      try { fs.unlinkSync(uploadedPath); } catch {}
    }
    const defaultLogo = '/virtuocity-logo.svg';
    if (!sharedTournamentState.config) {
      sharedTournamentState.config = {};
    }
    sharedTournamentState.config.logoUrl = defaultLogo;
    sharedTournamentState.lastUpdated = Date.now();
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
    } catch {}
    broadcastTournamentState();
    return res.json({ success: true, logoUrl: defaultLogo });
  });

  // Dedicated full-resolution team stats background upload endpoint
  app.post('/api/tournament/upload-team-stats-bg', (req, res) => {
    try {
      const { dataUrl, fileName } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid dataUrl parameter' });
      }

      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = 'png';

      if (matches && matches.length === 3) {
        const mimeType = matches[1].toLowerCase();
        if (mimeType.includes('svg')) ext = 'svg';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('webp')) ext = 'webp';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(dataUrl, 'base64');
      }

      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      // Save raw binary file at 100% full original resolution without compression or downsampling
      const targetPath = path.join(publicDir, `uploaded-team-stats-bg.${ext}`);
      fs.writeFileSync(targetPath, buffer);

      // Also ensure uploaded-team-stats-bg.png always exists for consistent route resolution
      if (ext !== 'png') {
        const pngFallback = path.join(publicDir, 'uploaded-team-stats-bg.png');
        try { fs.writeFileSync(pngFallback, buffer); } catch {}
      }

      const newBgUrl = `/api/tournament/team-stats-bg.png?v=${Date.now()}`;

      if (!sharedTournamentState.config) {
        sharedTournamentState.config = {};
      }
      sharedTournamentState.config.teamStatsBackgroundImage = newBgUrl;
      sharedTournamentState.lastUpdated = Date.now();

      try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
      } catch (e) {
        console.error('[Server] Failed to update tournament_state.json with team stats background', e);
      }

      console.log(`[Server] Saved full-resolution team stats background (${buffer.length} bytes, file: ${fileName || 'unnamed'})`);
      broadcastTournamentState();
      return res.json({
        success: true,
        bgUrl: newBgUrl,
        sizeBytes: buffer.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Server] Team stats background upload failed:', msg);
      return res.status(500).json({ error: 'Failed to process team stats background upload', details: msg });
    }
  });

  // Reset team stats background
  app.post('/api/tournament/reset-team-stats-bg', (req, res) => {
    const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
    for (const ext of extensions) {
      const p = path.join(process.cwd(), 'public', `uploaded-team-stats-bg.${ext}`);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }
    if (!sharedTournamentState.config) {
      sharedTournamentState.config = {};
    }
    sharedTournamentState.config.teamStatsBackgroundImage = '';
    sharedTournamentState.lastUpdated = Date.now();
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), 'utf-8');
    } catch {}
    broadcastTournamentState();
    return res.json({ success: true });
  });

  // Spectator API proxy endpoint to bypass ngrok/local browser CORS & SSL barriers
  app.get('/api/proxy-spectator', async (req, res) => {
    try {
      let targetUrl = req.query.url as string;
      if (!targetUrl || targetUrl === 'default' || targetUrl.includes('throwing-trapezoid') || targetUrl.includes('api.yousery.tech')) {
        targetUrl = 'https://main.yousery.tech/gettotalplayerlist';
      }

      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      const targetObj = new URL(targetUrl);
      if (targetObj.hostname.includes('ngrok')) {
        targetObj.searchParams.set('ngrok-skip-browser-warning', 'true');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const targetRes = await fetch(targetObj.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'PUBG-Spectator-Pro-Server/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const text = await targetRes.text();

      if (!targetRes.ok) {
        return res.status(targetRes.status).json({
          error: `Target server returned HTTP ${targetRes.status}`,
          details: text.slice(0, 300),
        });
      }

      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.status(502).json({
          error: 'Target URL returned HTML instead of JSON. Ensure ngrok tunnel is forwarding to local spectator port 10086.',
          snippet: text.slice(0, 300),
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({
        error: 'Failed to proxy request to target spectator API',
        details: errorMsg,
      });
    }
  });

  // Serve the tournament logo for /api/tournament/logo.png, /logo.png, /logo.svg, /virtuocity-logo.svg, or /uploaded-logo.png
  app.get(['/api/tournament/logo.png', '/api/tournament/logo', '/logo.png', '/logo.svg', '/virtuocity-logo.svg', '/uploaded-logo.png'], (req, res) => {
    const uploadedPng = path.join(process.cwd(), 'public', 'uploaded-logo.png');
    if (fs.existsSync(uploadedPng)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(uploadedPng);
    }
    const uploadedWebp = path.join(process.cwd(), 'public', 'uploaded-logo.webp');
    if (fs.existsSync(uploadedWebp)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(uploadedWebp);
    }
    const uploadedJpg = path.join(process.cwd(), 'public', 'uploaded-logo.jpg');
    if (fs.existsSync(uploadedJpg)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(uploadedJpg);
    }
    const logoFile = path.join(process.cwd(), 'public', 'virtuocity-logo.svg');
    if (fs.existsSync(logoFile)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(logoFile);
    }
    res.status(404).send('Logo not found');
  });

  // Serve full-resolution custom team stats background
  app.get([
    '/api/tournament/team-stats-bg.png',
    '/api/tournament/team-stats-bg',
    '/uploaded-team-stats-bg.png',
    '/uploaded-team-stats-bg.webp',
    '/uploaded-team-stats-bg.jpg',
    '/uploaded-team-stats-bg.jpeg',
    '/uploaded-team-stats-bg.svg'
  ], (req, res) => {
    const exts = [
      { ext: 'png', mime: 'image/png' },
      { ext: 'webp', mime: 'image/webp' },
      { ext: 'jpg', mime: 'image/jpeg' },
      { ext: 'jpeg', mime: 'image/jpeg' },
      { ext: 'svg', mime: 'image/svg+xml' }
    ];
    for (const { ext, mime } of exts) {
      const filePath = path.join(process.cwd(), 'public', `uploaded-team-stats-bg.${ext}`);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        return res.sendFile(filePath);
      }
    }
    res.status(404).send('Team stats background not found');
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PUBG Spectator Pro server running on port ${PORT}`);
  });
}

startServer();
