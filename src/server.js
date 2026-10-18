const path = require('path');

const { createApp } = require('./app');
const { loadConfig } = require('./config');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const PORT = process.env.PORT || 3000;

async function start() {
  const config = await loadConfig(CONFIG_PATH);
  const app = createApp(config);
  return app.listen(PORT, () => {
    console.log(`Image resizer backend listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start, CONFIG_PATH };
