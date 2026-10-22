const { randomUUID } = require('crypto');

const express = require('express');

const { createPipeline } = require('./pipeline/orchestrator');
const { discover } = require('./pipeline/discover');
const { DEFAULT_CONFIG, loadConfig, saveConfig } = require('./config');
const { RunManager } = require('./ws/runManager');

function pickRunId(candidate) {
  if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  return randomUUID();
}

function createApp(config = DEFAULT_CONFIG, runManager = new RunManager(), options = {}) {
  const app = express();
  app.use(express.json());

  const configPath = options.configPath || null;

  const readConfig = async () => (configPath ? loadConfig(configPath) : config);
  const writeConfig = async (next) => {
    if (configPath) {
      await saveConfig(configPath, next);
    } else {
      Object.assign(config, next);
    }
    return next;
  };

  app.get('/api/config', async (req, res) => {
    try {
      res.json(await readConfig());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/config', async (req, res) => {
    try {
      const current = await readConfig();
      const next = { ...current, ...(req.body ?? {}) };
      res.json(await writeConfig(next));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/process', async (req, res) => {
    const body = req.body ?? {};
    const runId = pickRunId(body.runId);

    try {
      const current = await readConfig();
      const runConfig = { ...current, ...body };
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
