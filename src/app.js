const { randomUUID } = require('crypto');

const express = require('express');

const { createPipeline } = require('./pipeline/orchestrator');
const { discover } = require('./pipeline/discover');
const { DEFAULT_CONFIG } = require('./config');
const { RunManager } = require('./ws/runManager');

function pickRunId(candidate) {
  if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  return randomUUID();
}

function createApp(config = DEFAULT_CONFIG, runManager = new RunManager()) {
  const app = express();
  app.use(express.json());

  app.post('/api/process', async (req, res) => {
    const body = req.body ?? {};
    const runConfig = { ...config, ...body };
    const runId = pickRunId(body.runId);

    try {
      // Count the batch up front so subscribers receive `started` with the
      // total before the first per-file event.
      const files = await discover(runConfig.sourcePath);
      const pipeline = createPipeline(runConfig);
      runManager.attach(runId, pipeline, files.length);
      const summary = await pipeline.run();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/errors/:runId', (req, res) => {
    const errors = runManager.errorsFor(req.params.runId);
    if (errors === null) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json({ runId: req.params.runId, errors });
  });

  return app;
}

module.exports = { createApp };
