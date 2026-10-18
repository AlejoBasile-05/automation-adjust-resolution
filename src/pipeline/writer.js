const fs = require('fs/promises');
const path = require('path');

function outputPathFor(sourcePath, destDir) {
  return path.join(destDir, path.basename(sourcePath));
}

async function writeOutput(destPath, buffer) {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buffer);
}

module.exports = { outputPathFor, writeOutput };
