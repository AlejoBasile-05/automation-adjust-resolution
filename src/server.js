const http = require('http');
const path = require('path');

const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { RunManager } = require('./ws/runManager');
const { attachWebSocketServer } = require('./ws/server');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const PORT = process.env.PORT || 3000;

async function start() {
  const config = await loadConfig(CONFIG_PATH);
  const runManager = new RunManager();
  const app = createApp(config, runManager, { configPath: CONFIG_PATH });
  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer, runManager);

  await new Promise((resolve) => httpServer.listen(PORT, resolve));
  console.log(`Image resizer backend listening on http://localhost:${PORT}`);

  return httpServer;
}

if (require.main === module) {
  start();
}

module.exports = { start, CONFIG_PATH };
