const express = require('express');

const { createPipeline } = require('./pipeline/orchestrator');
const { DEFAULT_CONFIG } = require('./config');

function createApp(config = DEFAULT_CONFIG) {
  const app = express();
  app.use(express.json());

  app.post('/api/process', async (req, res) => {
    const runConfig = { ...config, ...req.body };
    try {
      const summary = await createPipeline(runConfig).run();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
}

module.exports = { createApp };
