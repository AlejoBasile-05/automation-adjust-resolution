const fs = require('fs');
const path = require('path');

const { createElectronPicker } = require('../desktop/pickFolder');

const SELECTED_DIR = '/home/user/Pictures';

// The options argument is always last: it is the second argument when a
// parent window is passed and the first when there is none.
function dialogOptionsOf(showOpenDialog, index = 0) {
  const call = showOpenDialog.mock.calls[index];
  return call[call.length - 1];
}

function createPicker(overrides = {}) {
  const showOpenDialog = jest
    .fn()
    .mockResolvedValue({ canceled: false, filePaths: [SELECTED_DIR] });
  const getWindow = jest.fn().mockReturnValue(null);

  const pickFolder = createElectronPicker({
    showOpenDialog,
    getWindow,
    ...overrides,
  });

  return { pickFolder, showOpenDialog, getWindow };
}

describe('createElectronPicker (S5)', () => {
  test('returns the first selected path', async () => {
    const { pickFolder } = createPicker();

    await expect(pickFolder()).resolves.toEqual({ path: SELECTED_DIR });
  });

  test('returns { canceled: true } when the dialog is canceled', async () => {
    const { pickFolder } = createPicker({
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    });

    await expect(pickFolder()).resolves.toEqual({ canceled: true });
  });

  test('returns { canceled: true } when no paths are returned', async () => {
    const { pickFolder } = createPicker({
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    });

    await expect(pickFolder()).resolves.toEqual({ canceled: true });
  });

  test('requests a directory dialog that can create directories', async () => {
    const { pickFolder, showOpenDialog } = createPicker();

    await pickFolder();

    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(dialogOptionsOf(showOpenDialog)).toMatchObject({
      properties: ['openDirectory', 'createDirectory'],
    });
  });

  test('passes defaultPath only for a non-empty initial path', async () => {
    const withInitial = createPicker();
    await withInitial.pickFolder({ initialPath: SELECTED_DIR });
    expect(dialogOptionsOf(withInitial.showOpenDialog)).toMatchObject({
      defaultPath: SELECTED_DIR,
    });

    for (const initialPath of [undefined, '', 42]) {
      const picker = createPicker();
      await picker.pickFolder({ initialPath });
      expect(dialogOptionsOf(picker.showOpenDialog)).not.toHaveProperty('defaultPath');
    }
  });

  test('passes the current window to the dialog', async () => {
    const window = { id: 1 };
    const { pickFolder, showOpenDialog } = createPicker({
      getWindow: jest.fn().mockReturnValue(window),
    });

    await pickFolder();

    expect(showOpenDialog.mock.calls[0][0]).toBe(window);
  });

  test('works when there is no window yet', async () => {
    const { pickFolder, showOpenDialog } = createPicker({
      getWindow: jest.fn().mockReturnValue(null),
    });

    await expect(pickFolder()).resolves.toEqual({ path: SELECTED_DIR });
    // Without a window the dialog is called with the options only, so the
    // options object is the first argument rather than the second.
    expect(showOpenDialog.mock.calls[0]).toHaveLength(1);
    expect(dialogOptionsOf(showOpenDialog)).toMatchObject({
      properties: ['openDirectory', 'createDirectory'],
    });
  });

  test('does not spawn external processes', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'desktop', 'pickFolder.js'),
      'utf8',
    );

    expect(source).not.toMatch(/child_process/);
  });
});
