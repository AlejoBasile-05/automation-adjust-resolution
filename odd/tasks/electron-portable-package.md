# Portable Desktop Packaging (Electron)

**Objective:** Ship the image resizer as a one-click portable desktop app, with no Node install and no external dialog binary.
**Branch:** `feature/electron-portable`
**Delivery:** four work-unit commits on the feature branch; push to `main` after verification (personal repo, no PRs).
**Test runner:** Jest + Supertest (backend), Vitest (frontend)

---

## Specs

### S1 — Explicit config location

The server shall accept an explicit `configPath` and shall never depend on `process.cwd()` for anything the packaged app writes. The default `CONFIG_PATH` stays for `npm start` only; the packaged app always passes `app.getPath('userData')/config.json`.

**Acceptance criteria:** `start({ configPath })` writes only to that path. No file is created next to the executable.

### S2 — Backend serves the built frontend

`createApp(..., { staticDir })` shall serve the Vite build from that directory and fall back to `index.html` for non-API `GET` requests. Without `staticDir` the behavior is exactly today's.

**Acceptance criteria:** With `staticDir` set, `GET /` returns the built HTML and `GET /api/config` still returns JSON. Without it, nothing is served statically.

### S3 — Server forwards injection options

`start(options)` shall forward `staticDir` and `pickFolder` to `createApp`.

**Acceptance criteria:** A passed `pickFolder` stub is the one the endpoint calls.

### S4 — Electron shell lifecycle

The desktop shell shall acquire a single-instance lock, start the server on an OS-assigned port (`0`), open one window pointed at `http://127.0.0.1:<port>`, show it only when ready, and close the server on quit.

**Acceptance criteria:** The app works with port 3000 already occupied, shows no white flash on launch, and leaves no orphan process after closing.

### S5 — Native folder dialog replaces external binaries

Inside the desktop app, folder selection shall use Electron's native directory dialog and shall return the same `{ path }` / `{ canceled: true }` contract as the existing picker. The frontend shall require no changes.

**Acceptance criteria:** Clicking `Elegir…` opens the OS dialog without `zenity`; dismissing leaves the field unchanged.

### S6 — Renderer isolation

The BrowserWindow shall run with `nodeIntegration: false` and `contextIsolation: true`, and shall reach the backend exclusively over HTTP.

**Acceptance criteria:** The renderer has no `require` and no Node globals.

### S7 — Portable packaging

The app shall be packaged with electron-builder per platform: `AppImage` (Linux), `portable` (Windows), `dmg` + `zip` (macOS), with `asarUnpack` covering `sharp` and `@img/**` so libvips loads outside the archive.

**Acceptance criteria:** The Linux AppImage launches from an arbitrary directory and completes a resize batch.

### S8 — Runs without a system Node

The packaged app shall use its bundled runtime.

**Acceptance criteria:** Launching with no `node` on `PATH` still works.

### S9 — Regression

All existing behavior shall keep passing.

**Acceptance criteria:** Backend 82/82 or more, frontend 44/44, `vite build` green.

---

## Tasks

| ID | S# | Route | Description | Status | Commit |
|----|-----|-------|-------------|--------|--------|
| D1 | S1,S2,S3 | delegated | `staticDir` in `createApp`, SPA fallback, option forwarding in `start` | pending | — |
| D2 | S4,S5,S6 | delegated | Electron main process, native dialog adapter, lifecycle | pending | — |
| D3 | S7 | delegated | electron-builder config, asarUnpack for sharp, portable targets | pending | — |
| D4 | S8,S9 | inline | Build the AppImage and verify the packaged app end to end | pending | — |

## Log

**L1 (2026-10-23):** User request — "Actua como Desarrollador FullStack Senior experto en Despliegues y Empaquetado de Aplicaciones. Procede con la implementacion. Utiliza subagentes con skills adecuadas a su tarea."

**L2 (2026-10-23):** Preceding plan approved implicitly by the request to proceed. Stack decision: Electron over Tauri and Node SEA, because it reuses the Node backend unchanged and replaces `zenity`/`osascript`/PowerShell with one `dialog.showOpenDialog` per platform.

**Verified before planning:** `src/server.js:9` resolves config from `process.cwd()`; no `express.static` exists anywhere in `src/`; `useRunStream.js:56-60` builds the WebSocket URL from `window.location`, so serving the SPA over `http://127.0.0.1:<port>` needs no frontend change; `createApp` already accepts injectable `options.pickFolder` (added in `ae4c9b2`).

**Why the config cannot live next to the executable:** AppImage mounts the bundle as a read-only squashfs and macOS `.app` bundles must not be written into. `userData` is the only writable, persistent, per-user location.

**Express 5 gotcha:** path-to-regexp v8 rejects the bare `'*'` wildcard, so the SPA fallback must be a path-less middleware, not `app.get('*', ...)`.

**Delivery forecast:** ~450-600 authored lines. High-risk items 5 (packaging toolchain) and 3 (the `createApp`/`start` contract consumed by tests), so the packaging commit is reviewed alone and an independent verifier runs before delivery.
