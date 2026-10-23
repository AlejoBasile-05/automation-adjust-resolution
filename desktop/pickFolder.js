function createElectronPicker({ showOpenDialog, getWindow }) {
  return async function electronPickFolder({ initialPath = '' } = {}) {
    const dialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
    };

    if (typeof initialPath === 'string' && initialPath.length > 0) {
      dialogOptions.defaultPath = initialPath;
    }

    // Electron accepts the dialog with or without a parent window, but only
    // when the argument is genuinely absent. Passing an explicit `undefined`
    // as the first argument would be read as a missing window in some
    // versions, so the call shape is built rather than padded.
    const window = getWindow?.() ?? null;
    const result = window
      ? await showOpenDialog(window, dialogOptions)
      : await showOpenDialog(dialogOptions);

    if (result?.canceled || !result?.filePaths?.length) {
      return { canceled: true };
    }

    return { path: result.filePaths[0] };
  };
}

module.exports = { createElectronPicker };
