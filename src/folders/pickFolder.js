const { execFile } = require('node:child_process');

const TIMEOUT_MS = 300000;
const MAX_BUFFER_BYTES = 1024 * 1024;
const EXEC_OPTIONS = {
  timeout: TIMEOUT_MS,
  killSignal: 'SIGTERM',
  maxBuffer: MAX_BUFFER_BYTES,
};

const ZENITY_BASE_ARGS = ['--file-selection', '--directory', '--title=Elegir carpeta'];
const OSASCRIPT_ARGS = ['-e', 'POSIX path of (choose folder with prompt "Elegir carpeta")'];
const POWERSHELL_SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms;',
  '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
  "if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.SelectedPath } else { exit 1 }",
].join(' ');

function defaultRun(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function createPickerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildCommand(platform, initialPath) {
  const hasInitialPath = typeof initialPath === 'string' && initialPath.length > 0;

  if (platform === 'darwin') {
    return { file: 'osascript', args: OSASCRIPT_ARGS };
  }

  if (platform === 'win32') {
    return { file: 'powershell', args: ['-NoProfile', '-Command', POWERSHELL_SCRIPT] };
  }

  const args = [...ZENITY_BASE_ARGS];
  if (hasInitialPath) args.push(`--filename=${initialPath}/`);
  return { file: 'zenity', args };
}

function isCancellation(platform, error) {
  if (error.code !== 1) return false;
  if (platform === 'darwin') return /-128/.test(String(error.stderr ?? ''));
  return true;
}

function isTimeout(error) {
  return error.killed === true && error.signal === 'SIGTERM';
}

async function pickFolder({ initialPath = '', platform = process.platform, run = defaultRun } = {}) {
  const { file, args } = buildCommand(platform, initialPath);

  let result;
  try {
    result = await run(file, args, { ...EXEC_OPTIONS });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw createPickerError('UNSUPPORTED', `Folder dialog command not found: ${file}`);
    }
    if (isTimeout(error)) {
      throw createPickerError('TIMEOUT', 'Folder dialog did not respond before the timeout');
    }
    if (isCancellation(platform, error)) {
      return { canceled: true };
    }
    throw error;
  }

  return { path: String(result?.stdout ?? '').trim() };
}

module.exports = { pickFolder, createPickerError, defaultRun };
