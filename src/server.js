const http = require('http');
const path = require('path');

const { createApp } = require('./app');
const { loadConfig } = require('./config');
const { RunManager } = require('./ws/runManager');
const { attachWebSocketServer } = require('./ws/server');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

async function start(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const configPath = options.configPath ?? CONFIG_PATH;

  const config = await loadConfig(configPath);
  const runManager = new RunManager();
  const app = createApp(config, runManager, { configPath });
  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer, runManager);

  await new Promise((resolve) => httpServer.listen(port, '127.0.0.1', resolve));
  console.log(`Image resizer backend listening on http://127.0.0.1:${httpServer.address().port}`);

  return httpServer;
}

if (require.main === module) {
  start();
}

module.exports = { start, CONFIG_PATH };
