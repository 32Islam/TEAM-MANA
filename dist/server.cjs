var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");

// server/turso.ts
var import_client = require("@libsql/client");
var import_crypto = require("crypto");
var client = null;
var schemaPromise = null;
function getClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }
  client = (0, import_client.createClient)({
    url,
    authToken
  });
  return client;
}
async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = getClient();
    await db.batch([
      `CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        matches TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        is_current INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS tournaments_one_current_idx
        ON tournaments (is_current) WHERE is_current = 1`,
      `CREATE INDEX IF NOT EXISTS tournaments_updated_at_idx
        ON tournaments (updated_at DESC)`,
      `CREATE TABLE IF NOT EXISTS tournament_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`
    ], "write");
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}
function parseJson(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
async function getCurrentTournament() {
  const db = getClient();
  await ensureSchema();
  const result = await db.execute(`
    SELECT id, name, config, matches, status, created_at, updated_at
    FROM tournaments
    WHERE is_current = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name || "PUBG Mobile Tournament"),
    config: parseJson(row.config, {}),
    matches: parseJson(row.matches, []),
    status: String(row.status || "active"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
async function saveCurrentTournament(state) {
  const db = getClient();
  await ensureSchema();
  const currentResult = await db.execute(`
    SELECT id, config, matches
    FROM tournaments
    WHERE is_current = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const current = currentResult.rows[0];
  const config = state.config && typeof state.config === "object" ? state.config : parseJson(current?.config, {});
  const matches = Array.isArray(state.savedMatches) ? state.savedMatches : parseJson(current?.matches, []);
  const name = String(config?.name || "PUBG Mobile Tournament");
  const lastUpdated = Number(state.lastUpdated) || Date.now();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (current?.id) {
    await db.execute({
      sql: `
        UPDATE tournaments
        SET name = ?, config = ?, matches = ?, status = 'active', updated_at = ?
        WHERE id = ?
      `,
      args: [name, JSON.stringify(config), JSON.stringify(matches), now, String(current.id)]
    });
    return { id: String(current.id), lastUpdated, matchesCount: matches.length };
  }
  const id = (0, import_crypto.randomUUID)();
  await db.batch([
    {
      sql: `
        INSERT INTO tournaments
          (id, name, config, matches, status, is_current, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', 1, ?, ?)
      `,
      args: [id, name, JSON.stringify(config), JSON.stringify(matches), now, now]
    },
    {
      sql: `INSERT OR REPLACE INTO tournament_meta (key, value) VALUES ('current_tournament_id', ?)`,
      args: [id]
    }
  ], "write");
  return { id, lastUpdated, matchesCount: matches.length };
}
async function createNewTournament(config) {
  const db = getClient();
  await ensureSchema();
  const safeConfig = config && typeof config === "object" ? config : {};
  const name = String(safeConfig.name || "PUBG Mobile Tournament");
  const id = (0, import_crypto.randomUUID)();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.batch([
    `UPDATE tournaments
      SET is_current = 0,
          status = CASE WHEN status = 'active' THEN 'completed' ELSE status END,
          updated_at = '${now}'
      WHERE is_current = 1`,
    {
      sql: `
        INSERT INTO tournaments
          (id, name, config, matches, status, is_current, created_at, updated_at)
        VALUES (?, ?, ?, '[]', 'active', 1, ?, ?)
      `,
      args: [id, name, JSON.stringify(safeConfig), now, now]
    },
    {
      sql: `INSERT OR REPLACE INTO tournament_meta (key, value) VALUES ('current_tournament_id', ?)`,
      args: [id]
    }
  ], "write");
  return { id, name, createdAt: now };
}
async function healthCheckDb() {
  const db = getClient();
  await db.execute("SELECT 1");
  return true;
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  const STATE_FILE = import_path.default.join(process.cwd(), "tournament_state.json");
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(import_express.default.json({ limit: "50mb" }));
  let sharedTournamentState = {
    config: null,
    savedMatches: [],
    lastUpdated: Date.now()
  };
  let activeAdminLock = {
    deviceId: null,
    deviceName: null,
    acquiredAt: 0,
    lastHeartbeat: 0
  };
  const LOCK_TIMEOUT_MS = 9e3;
  try {
    if (import_fs.default.existsSync(STATE_FILE)) {
      const savedRaw = import_fs.default.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(savedRaw);
      if (parsed && typeof parsed === "object") {
        sharedTournamentState = {
          config: parsed.config || null,
          savedMatches: Array.isArray(parsed.savedMatches) ? parsed.savedMatches : [],
          lastUpdated: parsed.lastUpdated || Date.now()
        };
        console.log(`[Server] Loaded persistent tournament state (Matches: ${sharedTournamentState.savedMatches.length})`);
      }
    }
  } catch (err) {
    console.error("[Server] Could not load tournament_state.json", err);
  }
  const tursoConfigured = Boolean(process.env.TURSO_DATABASE_URL);
  if (tursoConfigured) {
    try {
      const remote = await getCurrentTournament();
      if (remote) {
        sharedTournamentState = {
          config: remote.config || null,
          savedMatches: Array.isArray(remote.matches) ? remote.matches : [],
          lastUpdated: new Date(remote.updatedAt).getTime() || Date.now()
        };
        console.log(`[Server] Loaded tournament from Turso (ID: ${remote.id}, Matches: ${sharedTournamentState.savedMatches.length})`);
      } else if (sharedTournamentState.config || sharedTournamentState.savedMatches.length > 0) {
        const migrated = await saveCurrentTournament({
          config: sharedTournamentState.config,
          savedMatches: sharedTournamentState.savedMatches,
          lastUpdated: sharedTournamentState.lastUpdated
        });
        console.log(`[Server] Migrated legacy tournament_state.json into Turso (ID: ${migrated.id})`);
      }
    } catch (err) {
      console.error("[Server] Turso startup failed; continuing with local JSON fallback:", err);
    }
  }
  const sseClients = /* @__PURE__ */ new Set();
  function broadcastTournamentState() {
    const payload = `data: ${JSON.stringify({
      type: "STATE_UPDATED",
      config: sharedTournamentState.config,
      savedMatches: sharedTournamentState.savedMatches,
      lastUpdated: sharedTournamentState.lastUpdated
    })}

`;
    for (const client2 of sseClients) {
      try {
        client2.write(payload);
      } catch {
        sseClients.delete(client2);
      }
    }
  }
  setInterval(() => {
    for (const client2 of sseClients) {
      try {
        client2.write(": heartbeat\n\n");
      } catch {
        sseClients.delete(client2);
      }
    }
  }, 15e3);
  app.get("/api/health", async (req, res) => {
    if (!tursoConfigured) {
      return res.json({ status: "ok", database: "local-file", time: (/* @__PURE__ */ new Date()).toISOString() });
    }
    try {
      await healthCheckDb();
      return res.json({ status: "ok", database: "turso", time: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (err) {
      return res.status(500).json({ status: "error", database: "turso", time: (/* @__PURE__ */ new Date()).toISOString() });
    }
  });
  app.post("/api/tournament/obs-test", (req, res) => {
    const payload = req.body || {};
    const msg = `data: ${JSON.stringify({
      type: "OBS_TEST_TRIGGER",
      ...payload
    })}

`;
    for (const client2 of sseClients) {
      try {
        client2.write(msg);
      } catch {
        sseClients.delete(client2);
      }
    }
    res.json({ success: true, timestamp: Date.now() });
  });
  app.get("/api/tournament/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({
      type: "INIT",
      config: sharedTournamentState.config,
      savedMatches: sharedTournamentState.savedMatches,
      lastUpdated: sharedTournamentState.lastUpdated
    })}

`);
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });
  app.get("/api/tournament/state", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.json(sharedTournamentState);
  });
  app.post("/api/tournament/state", async (req, res) => {
    const { config, savedMatches, lastUpdated } = req.body || {};
    if (config && typeof config === "object") {
      sharedTournamentState.config = {
        ...sharedTournamentState.config || {},
        ...config,
        teamFlags: config.teamFlags !== void 0 ? config.teamFlags : sharedTournamentState.config?.teamFlags || {}
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
        console.error("[Server] Turso save failed; writing local fallback:", err);
        try {
          const tempFile = `${STATE_FILE}.tmp`;
          import_fs.default.writeFileSync(tempFile, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
          import_fs.default.renameSync(tempFile, STATE_FILE);
        } catch (fileErr) {
          console.error("[Server] Local fallback write also failed", fileErr);
        }
      }
    } else {
      try {
        const tempFile = `${STATE_FILE}.tmp`;
        import_fs.default.writeFileSync(tempFile, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
        import_fs.default.renameSync(tempFile, STATE_FILE);
      } catch (err) {
        console.error("[Server] Failed to write tournament_state.json", err);
      }
    }
    broadcastTournamentState();
    res.json({
      success: true,
      lastUpdated: sharedTournamentState.lastUpdated,
      matchesCount: sharedTournamentState.savedMatches.length
    });
  });
  app.post("/api/tournament/reset", async (req, res) => {
    const nextConfig = req.body?.config && typeof req.body.config === "object" ? req.body.config : sharedTournamentState.config;
    if (tursoConfigured) {
      try {
        const created = await createNewTournament(nextConfig);
        sharedTournamentState = {
          config: nextConfig || null,
          savedMatches: [],
          lastUpdated: Date.now()
        };
        broadcastTournamentState();
        return res.json({
          success: true,
          tournamentId: created.id,
          lastUpdated: sharedTournamentState.lastUpdated,
          matchesCount: 0
        });
      } catch (err) {
        console.error("[Server] Turso new tournament failed:", err);
        return res.status(500).json({ success: false, error: "Could not create new tournament" });
      }
    }
    sharedTournamentState.savedMatches = [];
    sharedTournamentState.lastUpdated = Date.now();
    try {
      const tempFile = `${STATE_FILE}.tmp`;
      import_fs.default.writeFileSync(tempFile, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
      import_fs.default.renameSync(tempFile, STATE_FILE);
    } catch (err) {
      console.error("[Server] Failed to reset tournament_state.json", err);
    }
    broadcastTournamentState();
    return res.json({ success: true, lastUpdated: sharedTournamentState.lastUpdated, matchesCount: 0 });
  });
  app.get("/api/admin/lock", (req, res) => {
    const now = Date.now();
    const isLockActive = Boolean(
      activeAdminLock.deviceId && now - activeAdminLock.lastHeartbeat < LOCK_TIMEOUT_MS
    );
    res.json({
      isLocked: isLockActive,
      activeSession: isLockActive ? activeAdminLock : null,
      serverTime: now
    });
  });
  app.post("/api/admin/lock/acquire", (req, res) => {
    const { deviceId, deviceName, force } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    const now = Date.now();
    const isLockActive = Boolean(
      activeAdminLock.deviceId && activeAdminLock.deviceId !== deviceId && now - activeAdminLock.lastHeartbeat < LOCK_TIMEOUT_MS
    );
    if (isLockActive && !force) {
      return res.json({
        success: false,
        reason: "LOCKED_BY_ANOTHER_DEVICE",
        activeSession: activeAdminLock,
        lockedByOther: true
      });
    }
    activeAdminLock = {
      deviceId,
      deviceName: deviceName || "Admin Device",
      acquiredAt: activeAdminLock.deviceId === deviceId ? activeAdminLock.acquiredAt || now : now,
      lastHeartbeat: now
    };
    res.json({
      success: true,
      activeSession: activeAdminLock,
      lockedByOther: false
    });
  });
  app.post("/api/admin/lock/heartbeat", (req, res) => {
    const { deviceId, deviceName } = req.body || {};
    const now = Date.now();
    if (!activeAdminLock.deviceId || activeAdminLock.deviceId === deviceId || now - activeAdminLock.lastHeartbeat >= LOCK_TIMEOUT_MS) {
      activeAdminLock = {
        deviceId,
        deviceName: deviceName || activeAdminLock.deviceName || "Admin Device",
        acquiredAt: activeAdminLock.acquiredAt || now,
        lastHeartbeat: now
      };
      return res.json({ success: true, activeSession: activeAdminLock, isOwner: true });
    }
    return res.json({
      success: false,
      isOwner: false,
      activeSession: activeAdminLock
    });
  });
  app.post("/api/admin/lock/release", (req, res) => {
    const { deviceId } = req.body || {};
    if (activeAdminLock.deviceId === deviceId) {
      activeAdminLock = {
        deviceId: null,
        deviceName: null,
        acquiredAt: 0,
        lastHeartbeat: 0
      };
    }
    res.json({ success: true });
  });
  app.post("/api/tournament/upload-logo", (req, res) => {
    try {
      const { dataUrl, fileName } = req.body || {};
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Missing or invalid dataUrl parameter" });
      }
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = "png";
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        if (mimeType.includes("svg")) ext = "svg";
        else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
        else if (mimeType.includes("webp")) ext = "webp";
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(dataUrl, "base64");
      }
      const publicDir = import_path.default.join(process.cwd(), "public");
      if (!import_fs.default.existsSync(publicDir)) {
        import_fs.default.mkdirSync(publicDir, { recursive: true });
      }
      const targetPath = import_path.default.join(publicDir, `uploaded-logo.${ext}`);
      import_fs.default.writeFileSync(targetPath, buffer);
      if (ext !== "png") {
        const pngFallback = import_path.default.join(publicDir, "uploaded-logo.png");
        try {
          import_fs.default.writeFileSync(pngFallback, buffer);
        } catch {
        }
      }
      const newLogoUrl = `/api/tournament/logo.png?v=${Date.now()}`;
      if (!sharedTournamentState.config) {
        sharedTournamentState.config = {};
      }
      sharedTournamentState.config.logoUrl = newLogoUrl;
      sharedTournamentState.lastUpdated = Date.now();
      try {
        import_fs.default.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
      } catch (e) {
        console.error("[Server] Failed to update tournament_state.json with new logo", e);
      }
      console.log(`[Server] Successfully saved uploaded logo (${buffer.length} bytes, file: ${fileName || "unnamed"})`);
      broadcastTournamentState();
      return res.json({
        success: true,
        logoUrl: newLogoUrl,
        sizeBytes: buffer.length
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Server] Logo upload failed:", msg);
      return res.status(500).json({ error: "Failed to process logo upload", details: msg });
    }
  });
  app.post("/api/tournament/reset-logo", (req, res) => {
    const uploadedPath = import_path.default.join(process.cwd(), "public", "uploaded-logo.png");
    if (import_fs.default.existsSync(uploadedPath)) {
      try {
        import_fs.default.unlinkSync(uploadedPath);
      } catch {
      }
    }
    const defaultLogo = "/virtuocity-logo.svg";
    if (!sharedTournamentState.config) {
      sharedTournamentState.config = {};
    }
    sharedTournamentState.config.logoUrl = defaultLogo;
    sharedTournamentState.lastUpdated = Date.now();
    try {
      import_fs.default.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
    } catch {
    }
    broadcastTournamentState();
    return res.json({ success: true, logoUrl: defaultLogo });
  });
  app.post("/api/tournament/upload-team-stats-bg", (req, res) => {
    try {
      const { dataUrl, fileName } = req.body || {};
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Missing or invalid dataUrl parameter" });
      }
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = "png";
      if (matches && matches.length === 3) {
        const mimeType = matches[1].toLowerCase();
        if (mimeType.includes("svg")) ext = "svg";
        else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
        else if (mimeType.includes("webp")) ext = "webp";
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(dataUrl, "base64");
      }
      const publicDir = import_path.default.join(process.cwd(), "public");
      if (!import_fs.default.existsSync(publicDir)) {
        import_fs.default.mkdirSync(publicDir, { recursive: true });
      }
      const targetPath = import_path.default.join(publicDir, `uploaded-team-stats-bg.${ext}`);
      import_fs.default.writeFileSync(targetPath, buffer);
      if (ext !== "png") {
        const pngFallback = import_path.default.join(publicDir, "uploaded-team-stats-bg.png");
        try {
          import_fs.default.writeFileSync(pngFallback, buffer);
        } catch {
        }
      }
      const newBgUrl = `/api/tournament/team-stats-bg.png?v=${Date.now()}`;
      if (!sharedTournamentState.config) {
        sharedTournamentState.config = {};
      }
      sharedTournamentState.config.teamStatsBackgroundImage = newBgUrl;
      sharedTournamentState.lastUpdated = Date.now();
      try {
        import_fs.default.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
      } catch (e) {
        console.error("[Server] Failed to update tournament_state.json with team stats background", e);
      }
      console.log(`[Server] Saved full-resolution team stats background (${buffer.length} bytes, file: ${fileName || "unnamed"})`);
      broadcastTournamentState();
      return res.json({
        success: true,
        bgUrl: newBgUrl,
        sizeBytes: buffer.length
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Server] Team stats background upload failed:", msg);
      return res.status(500).json({ error: "Failed to process team stats background upload", details: msg });
    }
  });
  app.post("/api/tournament/reset-team-stats-bg", (req, res) => {
    const extensions = ["png", "jpg", "jpeg", "webp", "svg"];
    for (const ext of extensions) {
      const p = import_path.default.join(process.cwd(), "public", `uploaded-team-stats-bg.${ext}`);
      if (import_fs.default.existsSync(p)) {
        try {
          import_fs.default.unlinkSync(p);
        } catch {
        }
      }
    }
    if (!sharedTournamentState.config) {
      sharedTournamentState.config = {};
    }
    sharedTournamentState.config.teamStatsBackgroundImage = "";
    sharedTournamentState.lastUpdated = Date.now();
    try {
      import_fs.default.writeFileSync(STATE_FILE, JSON.stringify(sharedTournamentState, null, 2), "utf-8");
    } catch {
    }
    broadcastTournamentState();
    return res.json({ success: true });
  });
  app.get("/api/proxy-spectator", async (req, res) => {
    try {
      let targetUrl = req.query.url;
      if (!targetUrl || targetUrl === "default" || targetUrl.includes("throwing-trapezoid") || targetUrl.includes("api.yousery.tech")) {
        targetUrl = "https://main.yousery.tech/gettotalplayerlist";
      }
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }
      const targetObj = new URL(targetUrl);
      if (targetObj.hostname.includes("ngrok")) {
        targetObj.searchParams.set("ngrok-skip-browser-warning", "true");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6e3);
      const targetRes = await fetch(targetObj.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "PUBG-Spectator-Pro-Server/1.0"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      const text = await targetRes.text();
      if (!targetRes.ok) {
        return res.status(targetRes.status).json({
          error: `Target server returned HTTP ${targetRes.status}`,
          details: text.slice(0, 300)
        });
      }
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.status(502).json({
          error: "Target URL returned HTML instead of JSON. Ensure ngrok tunnel is forwarding to local spectator port 10086.",
          snippet: text.slice(0, 300)
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({
        error: "Failed to proxy request to target spectator API",
        details: errorMsg
      });
    }
  });
  app.get(["/api/tournament/logo.png", "/api/tournament/logo", "/logo.png", "/logo.svg", "/virtuocity-logo.svg", "/uploaded-logo.png"], (req, res) => {
    const uploadedPng = import_path.default.join(process.cwd(), "public", "uploaded-logo.png");
    if (import_fs.default.existsSync(uploadedPng)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      return res.sendFile(uploadedPng);
    }
    const uploadedWebp = import_path.default.join(process.cwd(), "public", "uploaded-logo.webp");
    if (import_fs.default.existsSync(uploadedWebp)) {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      return res.sendFile(uploadedWebp);
    }
    const uploadedJpg = import_path.default.join(process.cwd(), "public", "uploaded-logo.jpg");
    if (import_fs.default.existsSync(uploadedJpg)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      return res.sendFile(uploadedJpg);
    }
    const logoFile = import_path.default.join(process.cwd(), "public", "virtuocity-logo.svg");
    if (import_fs.default.existsSync(logoFile)) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.sendFile(logoFile);
    }
    res.status(404).send("Logo not found");
  });
  app.get([
    "/api/tournament/team-stats-bg.png",
    "/api/tournament/team-stats-bg",
    "/uploaded-team-stats-bg.png",
    "/uploaded-team-stats-bg.webp",
    "/uploaded-team-stats-bg.jpg",
    "/uploaded-team-stats-bg.jpeg",
    "/uploaded-team-stats-bg.svg"
  ], (req, res) => {
    const exts = [
      { ext: "png", mime: "image/png" },
      { ext: "webp", mime: "image/webp" },
      { ext: "jpg", mime: "image/jpeg" },
      { ext: "jpeg", mime: "image/jpeg" },
      { ext: "svg", mime: "image/svg+xml" }
    ];
    for (const { ext, mime } of exts) {
      const filePath = import_path.default.join(process.cwd(), "public", `uploaded-team-stats-bg.${ext}`);
      if (import_fs.default.existsSync(filePath)) {
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
        return res.sendFile(filePath);
      }
    }
    res.status(404).send("Team stats background not found");
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PUBG Spectator Pro server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
