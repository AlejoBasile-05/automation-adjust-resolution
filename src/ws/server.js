const { WebSocketServer } = require('ws');

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
const MAX_RUN_ID_LENGTH = 128;

/** Extract a validated runId from a `/ws?runId=...` upgrade URL. */
function runIdFromRequest(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl, 'http://localhost');
  } catch (error) {
    return null;
  }

  if (url.pathname !== '/ws') return null;

  const runId = url.searchParams.get('runId');
  if (runId === null) return null;

  const trimmed = runId.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RUN_ID_LENGTH) return null;

  return trimmed;
}

function rejectUpgrade(socket, statusCode, message) {
  socket.write(
    `HTTP/1.1 ${statusCode} Bad Request\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain\r\n' +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      '\r\n' +
      message
  );
  socket.destroy();
}

/**
 * Mount a WebSocket server on an existing HTTP server. Clients connect to
 * `/ws?runId=<id>` and are bound to that run in the RunManager.
 */
function attachWebSocketServer(httpServer, runManager, options = {}) {
  const heartbeatInterval = options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const runId = runIdFromRequest(request.url);
    if (!runId) {
      rejectUpgrade(socket, 400, 'Missing or invalid runId');
      return;
    }

    wss.handleUpgrade(request, socket, head, (webSocket) => {
      webSocket.runId = runId;
      wss.emit('connection', webSocket, request);
    });
  });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    runManager.register(socket.runId, socket);
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive) {
        socket.isAlive = false;
        try {
          socket.ping();
        } catch (error) {
          // The socket disappeared between ticks; the close handler cleans up.
        }
      } else {
        socket.terminate();
      }
    }
  }, heartbeatInterval);

  const stopHeartbeat = () => clearInterval(heartbeat);
  wss.on('close', stopHeartbeat);
  httpServer.on('close', stopHeartbeat);

  return wss;
}

module.exports = { attachWebSocketServer, runIdFromRequest };
