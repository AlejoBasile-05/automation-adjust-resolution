const { EventEmitter } = require('events');

const { discover } = require('./discover');
const { resize } = require('./resize');
const { outputPathFor, writeOutput } = require('./writer');

function createPipeline(config) {
  const emitter = new EventEmitter();
  // Keep per-file failures from crashing the process when no observer is attached.
  emitter.on('error', () => {});

  const processFile = async (file, summary) => {
    try {
      const buffer = await resize(file, config);
      await writeOutput(outputPathFor(file, config.destPath), buffer);
      summary.processed += 1;
      emitter.emit('progress', {
        file,
        processed: summary.processed,
        total: summary.total,
      });
    } catch (error) {
      summary.errors.push({ file, message: error.message });
      emitter.emit('error', { file, error });
    }
  };

  emitter.run = async () => {
    const files = await discover(config.sourcePath);
    const summary = { total: files.length, processed: 0, errors: [] };

    for (const file of files) {
      await processFile(file, summary);
    }

    emitter.emit('done', summary);
    return summary;
  };

  return emitter;
}

module.exports = { createPipeline };
