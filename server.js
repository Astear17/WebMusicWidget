const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const cp = require("child_process");

const ADAPTER_PORT = 8974;
const HTTP_PORT = 8080;
const ADAPTER_VERSION = "1.0.0";
const WNPLIB_REVISION = 3;

const STATE_PLAYING = 0;
const STATE_PAUSED = 1;
const STATE_STOPPED = 2;

const MSG_PLAYER_ADDED = 0;
const MSG_PLAYER_UPDATED = 1;
const MSG_PLAYER_REMOVED = 2;
const MSG_EVENT_RESULT = 3;

const players = new Map();
const overlayClients = new Set();

function startNativeMediaReader() {
  const exePath = path.join(__dirname, "MediaReader.exe");
  if (!fs.existsSync(exePath)) {
    console.warn("[MediaReader] Native adapter not found. Compile MediaReader.cs first.");
    return;
  }
  
  console.log("[MediaReader] Starting native Windows Media Session hook...");
  const proc = cp.spawn(exePath);
  let buffer = "";

  proc.stdout.on("data", (data) => {
    buffer += data.toString("utf-8");
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) > -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      
      if (!line) continue;
      try {
        const payload = JSON.parse(line);
        if (payload.type === "clear") {
          players.delete("local_desktop");
        } else {
          players.set("local_desktop", {
            name: payload.player,
            title: payload.title,
            artist: payload.artist,
            album: payload.album,
            state: payload.state,
            position: payload.position,
            duration: payload.duration,
            coverSrc: payload.coverSrc,
            volume: 100,
            activeAt: Date.now()
          });
        }
        broadcastToOverlays();
      } catch (e) {
        console.error("[MediaReader] Parse error:", e.message, line);
      }
    }
  });

  proc.on("close", () => {
    console.log("[MediaReader] Process exited. Restarting in 3s...");
    setTimeout(startNativeMediaReader, 3000);
  });
}

startNativeMediaReader();

function unescapePipe(str) {
  return str.replace(/\\\|/g, "|");
}

function parsePlayerFields(raw) {
  const tokens = [];
  let current = "";
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "\\" && raw[i + 1] === "|") {
      current += "|";
      i += 2;
    } else if (raw[i] === "|") {
      tokens.push(current);
      current = "";
      i++;
    } else {
      current += raw[i];
      i++;
    }
  }
  if (current.length > 0) tokens.push(current);

  const fieldNames = [
    "portId", "name", "title", "artist", "album", "coverSrc",
    "state", "position", "duration", "volume", "rating", "repeat",
    "shuffle", "ratingSystem", "availableRepeat",
    "canSetState", "canSkipPrevious", "canSkipNext",
    "canSetPosition", "canSetVolume", "canSetRating",
    "canSetRepeat", "canSetShuffle",
    "createdAt", "updatedAt", "activeAt"
  ];

  const intFields = new Set([
    "portId", "state", "position", "duration", "volume", "rating",
    "repeat", "shuffle", "ratingSystem", "availableRepeat",
    "canSetState", "canSkipPrevious", "canSkipNext",
    "canSetPosition", "canSetVolume", "canSetRating",
    "canSetRepeat", "canSetShuffle"
  ]);

  const bigintFields = new Set(["createdAt", "updatedAt", "activeAt"]);

  const result = {};
  for (let j = 0; j < tokens.length && j < fieldNames.length; j++) {
    const name = fieldNames[j];
    let val = tokens[j];

    if (val === "\x01") val = "";

    if (intFields.has(name)) {
      result[name] = parseInt(val, 10) || 0;
    } else if (bigintFields.has(name)) {
      result[name] = val;
    } else {
      result[name] = val;
    }
  }

  return result;
}

function getActivePlayer() {
  let activePlayer = null;
  let latestActive = 0;

  for (const p of players.values()) {
    const at = parseInt(p.activeAt || "0", 10);
    if (p.state === STATE_PLAYING && at > latestActive) {
      latestActive = at;
      activePlayer = p;
    }
  }

  if (!activePlayer) {
    let latestAny = 0;
    for (const p of players.values()) {
      const at = parseInt(p.activeAt || "0", 10);
      if (at > latestAny) {
        latestAny = at;
        activePlayer = p;
      }
    }
  }
  return activePlayer;
}

function broadcastToOverlays() {
  const activePlayer = getActivePlayer();
  const payload = JSON.stringify({
    type: activePlayer ? "update" : "clear",
    player: activePlayer
      ? {
          name: activePlayer.name || "",
          title: activePlayer.title || "",
          artist: activePlayer.artist || "",
          album: activePlayer.album || "",
          state: activePlayer.state,
          position: activePlayer.position,
          duration: activePlayer.duration,
          volume: activePlayer.volume,
          coverSrc: activePlayer.coverSrc || ""
        }
      : null
  });

  for (const client of overlayClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const adapterWss = new WebSocketServer({ port: ADAPTER_PORT });
console.log(`[WNP Adapter] Listening on ws://127.0.0.1:${ADAPTER_PORT}`);

adapterWss.on("connection", (ws) => {
  console.log("[WNP Adapter] Browser extension connected");

  const handshake = `ADAPTER_VERSION ${ADAPTER_VERSION};WNPLIB_REVISION ${WNPLIB_REVISION}`;
  ws.send(handshake);

  ws.on("message", (data, isBinary) => {
    if (isBinary) return;

    const msg = data.toString("utf-8");
    
    // Check if it's JSON format (default for custom adapters)
    if (msg.trim().startsWith('{')) {
      try {
        const payload = JSON.parse(msg);
        console.log(`[WNP JSON] Received: ${msg}`);
        
        // Handle WNP Redux JSON format
        // Expected: { title: "...", artist: "...", state: 1, ... }
        // state: 1 is usually playing in JSON format, 2 is paused
        
        let normalizedState = STATE_STOPPED;
        if (payload.state === 1) normalizedState = STATE_PLAYING;
        if (payload.state === 2) normalizedState = STATE_PAUSED;
        if (payload.state === 0) normalizedState = STATE_STOPPED; // Some versions use 0 for stopped

        const key = `${ws._socketId}_json`;
        const updated = {
          name: payload.player || "Browser",
          title: payload.title || "",
          artist: payload.artist || "",
          album: payload.album || "",
          state: normalizedState,
          position: payload.position || 0,
          duration: payload.duration || 0,
          volume: payload.volume || 100,
          activeAt: Date.now()
        };
        
        const existing = players.get(key);
        if (existing) {
          Object.assign(existing, updated);
        } else {
          updated._ws = ws;
          players.set(key, updated);
        }
        broadcastToOverlays();
        return;
      } catch (e) {
        console.error("[WNP Adapter] Failed to parse JSON", e);
      }
    }

    const spaceIdx = msg.indexOf(" ");
    if (spaceIdx === -1) return;

    const typeStr = msg.substring(0, spaceIdx);
    const rest = msg.substring(spaceIdx + 1);
    const msgType = parseInt(typeStr, 10);

    switch (msgType) {
      case MSG_PLAYER_ADDED: {
        const secondSpace = rest.indexOf(" ");
        if (secondSpace === -1) return;
        const portId = parseInt(rest.substring(0, secondSpace), 10);
        const fieldData = rest.substring(secondSpace + 1);
        const player = parsePlayerFields(fieldData);
        player._portId = portId;
        player._ws = ws;
        players.set(`${ws._socketId}_${portId}`, player);
        console.log(`[WNP] Player added: "${player.name}" — "${player.title}" by ${player.artist}`);
        broadcastToOverlays();
        break;
      }
      case MSG_PLAYER_UPDATED: {
        const secondSpace = rest.indexOf(" ");
        if (secondSpace === -1) return;
        const portId = parseInt(rest.substring(0, secondSpace), 10);
        const fieldData = rest.substring(secondSpace + 1);
        const updated = parsePlayerFields(fieldData);
        const key = `${ws._socketId}_${portId}`;
        const existing = players.get(key);
        if (existing) {
          Object.assign(existing, updated);
          console.log(`[WNP] Player updated: "${existing.title}" by ${existing.artist} [state=${existing.state}]`);
        } else {
          updated._portId = portId;
          updated._ws = ws;
          players.set(key, updated);
        }
        broadcastToOverlays();
        break;
      }
      case MSG_PLAYER_REMOVED: {
        const portId = parseInt(rest, 10);
        const key = `${ws._socketId}_${portId}`;
        const removed = players.get(key);
        if (removed) {
          console.log(`[WNP] Player removed: "${removed.title}"`);
          players.delete(key);
        }
        broadcastToOverlays();
        break;
      }
      case MSG_EVENT_RESULT: {
        break;
      }
    }
  });

  let socketCounter = 0;
  ws._socketId = ++socketCounter;

  ws.on("close", () => {
    console.log("[WNP Adapter] Browser extension disconnected");
    for (const [key, player] of players.entries()) {
      if (player._ws === ws) {
        players.delete(key);
      }
    }
    broadcastToOverlays();
  });
});

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

const httpServer = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/overlay.html" : req.url;
  filePath = path.join(__dirname, "public", filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

const overlayWss = new WebSocketServer({ server: httpServer, path: "/ws" });

overlayWss.on("connection", (ws) => {
  console.log("[Overlay] Client connected");
  overlayClients.add(ws);

  broadcastToOverlays();

  ws.on("close", () => {
    overlayClients.delete(ws);
    console.log("[Overlay] Client disconnected");
  });
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[HTTP Server] Overlay at http://localhost:${HTTP_PORT}/overlay.html`);
  console.log(`[WebSocket]   Overlay WS at ws://localhost:${HTTP_PORT}/ws`);
  console.log("");
  console.log("=== Setup ===");
  console.log("1. Install 'WebNowPlaying' browser extension");
  console.log(`2. In extension settings, add custom adapter: ws://localhost:${ADAPTER_PORT}`);
  console.log("3. Play a YouTube video in your browser");
  console.log(`4. Add http://localhost:${HTTP_PORT}/overlay.html as Browser Source in TikTok LIVE Studio`);
  console.log("");
  console.log("For HTTPS (required by TikTok LIVE Studio):");
  console.log(`   cloudflared tunnel --url http://localhost:${HTTP_PORT}`);
  console.log("   Then use the generated https://...trycloudflare.com URL");
});
