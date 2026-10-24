# Image Resizer Automation

**Branch:** main
**Delivery strategy:** ask-on-risk
**Test runner:** Jest + Supertest (backend), Vitest (frontend)

---

## Summary

Automated image resolution adjustment tool that monitors a source folder, resizes images to a user-specified target resolution, and saves the processed output to a destination folder. Includes a web-based frontend for configuring source/destination paths, target resolution, and monitoring batch progress.

## Primary Objective

Eliminate the manual, repetitive workflow of resizing large image batches by providing an automated pipeline with a simple configuration UI — the user defines the folders and desired resolution once, and the system handles the rest.

## General Context

This project targets users who routinely work with large collections of images (e.g., photographers, content teams, e-commerce operations) and need consistent resolution normalization across batches. The current manual process involves opening each image in an editor, adjusting dimensions, and saving individually — slow and error-prone.

### Architecture Overview

- **Backend:** Node.js with Express API that orchestrates the resize pipeline, watches the source folder, applies transformations via Sharp, and writes results to the destination folder. Exposes REST endpoints for configuration and status.
- **Frontend:** Single-page application (React + Vite + Tailwind) providing a control panel to set source/destination directories, target width/height, format, quality, and to start/stop the automation with live progress feedback.
- **Storage:** No database required. Configuration persisted as JSON on disk; images stored in filesystem folders chosen by the user.
- **Concurrency:** Image processing uses a worker pool with configurable parallelism to avoid blocking the API or saturating I/O.

### Non-Goals

- No cloud storage integration (local filesystem only).
- No image format conversion beyond what Sharp supports natively (no HEIC/WebP encoding edge cases beyond defaults).
- No user authentication (local tool, single-user).

### Success Criteria

1. User can configure source/destination folders and target resolution via the frontend.
2. All supported images in the source folder are resized and saved to the destination folder.
3. Real-time progress (completed/total) is visible during processing.
4. Processing errors (unsupported formats, corrupt files) are reported without halting the batch.
5. The system is idempotent — re-running on the same input produces consistent output.

---

## Specs

### S1 — Image ingestion

The system shall scan the source folder recursively for image files with extensions `.jpg`, `.jpeg`, `.png`, `.webp`, `.tiff`, `.gif`. Hidden files (dot-prefixed) and non-image files shall be ignored.

**Acceptance criteria:**
 A folder containing mixed files yields only supported images in the processing queue.

### S2 — Resolution adjustment

Each image shall be resized to a target **physical size in centimeters** (width × height) at a configurable **DPI** (dots per inch, default `300`, valid range `1..1200`), so a document can be produced at its real print size regardless of screen resolution. The pixel result is computed as `px = round(cm / 2.54 * dpi)`. The resize mode `fit: 'inside'` (contain within bounds, preserving aspect ratio) shall be used by default, with an optional `fit: 'fill'` (stretch to exact dimensions) mode selectable in the frontend.

**Acceptance criteria:** Every output image matches the target dimensions (inside mode preserves aspect ratio; fill mode matches exactly). `10 × 7.5 cm` at `300 DPI` yields `1181 × 886 px`.

### S3 — Output persistence

Resized images shall be saved to the destination folder with the same base filename and extension as the source. Existing files in the destination folder shall be overwritten without prompt. The destination folder shall be created automatically if it does not exist.

**Acceptance criteria:** Destination folder contains one resized output per source image, with correct dimensions.

### S4 — Batch monitoring

The frontend shall display real-time progress: number of images processed, total count, current file being processed, and any errors encountered. Updates shall be pushed via WebSocket or polling.

**Acceptance criteria:** User sees live progress that reaches 100% on completion, including per-file error indicators.

### S5 — Error resilience

Processing errors (unsupported format, read/write permission, corrupt file) shall be logged per-file and reported in the frontend without stopping the batch. The system shall continue processing remaining images.

**Acceptance criteria:** A folder with one corrupt image still produces valid output for all other images, with the corrupt file listed as an error.

### S6 — Configuration persistence

Source path, destination path, target width/height in centimeters, DPI, resize mode, format, and quality settings shall be persisted to a JSON config file on disk under `schemaVersion: 2`. The frontend shall load these values on startup. A legacy configuration written in pixels (no `schemaVersion`) shall be migrated to centimeters at `300 DPI` and rewritten; a legacy pixel value shall never be reinterpreted as centimeters.

**Acceptance criteria:** After a page reload, all previously configured settings are restored. A `{"width": 800, "height": 600}` config reads back as `widthCm ≈ 6.77`, `heightCm ≈ 5.08`, `dpi: 300`.

### S7 — Native folder selection

Each folder field shall offer a button that opens the operating system's native folder dialog and fills the input with the chosen absolute path. The dialog shall be launched by the backend through an argument array, never a shell string. Dismissing the dialog shall leave the current value unchanged; a platform without a supported dialog shall report it so the user can type the path manually.

**Acceptance criteria:** Choosing a folder populates the field, cancelling does not alter it, and an unsupported platform shows a manual-entry fallback message.

### S8 — Local-only network binding

The HTTP server shall bind the loopback interface (`127.0.0.1`) instead of every interface, since the tool exposes local filesystem operations and a native dialog launcher.

**Acceptance criteria:** The listening socket reports `127.0.0.1`.

---

### S9 — Portable desktop packaging (Electron)

The application shall be packaged as a portable desktop app using Electron and electron-builder. The packaged app must:
- Run with a single click, without requiring Node.js installed on the target system.
- Use the OS native folder dialog (Electron's `dialog.showOpenDialog`) instead of external binaries (`zenity`, `osascript`, PowerShell).
- Store configuration in `app.getPath('userData')` (not next to the executable).
- Serve the built frontend SPA from the asar archive.
- Include `sharp` and `@img/**` native binaries unpacked outside the asar (libvips loads from disk).
- Build targets: `AppImage` (Linux), `portable` (Windows), `dmg` + `zip` (macOS).

**Acceptance criteria:** The Linux AppImage launches from an arbitrary directory and completes a resize batch. The app runs without `node` on `PATH`.

---

## Tasks

| ID | S# | Route | Description | Status | Commit |
|----|-----|-------|-------------|--------|--------|
| T1 | S1,S2,S3 | delegated | Backend: Express server + Sharp resize pipeline + filesystem watcher | done | `5a34435` |
| T2 | S4 | delegated | Backend: WebSocket endpoint for real-time progress | done | `f545212` |
| T3 | S5 | delegated | Backend: Error handling + per-file error reporting | done | `5a280f8` |
| T4 | S6 | inline | Backend: Config persistence API (GET/PUT /api/config) | done | `d39353c` |
| T5 | S4,S6 | delegated | Frontend: React + Vite + Tailwind config panel with live progress | done | `005afbe` |
| T6 | S2,S6 | delegated | Centimeters + configurable DPI with schema v2 migration | done | `9a40628` |
| T7 | S7,S8 | delegated | Native folder picker and loopback-only binding | done | `ae4c9b2` |
| T8 | S2,S6,S7 | inline | Verification follow-ups: version-less cm configs, geometry validation on PUT | done | `e36ba59` |
| D1 | S1,S2,S3 | delegated | Desktop: `staticDir` in `createApp`, SPA fallback, option forwarding in `start` | done | `7108b70` |
| D2 | S4,S5,S6 | delegated | Desktop: Electron main process, native dialog adapter, lifecycle | done | `afcfec7` |
| D3 | S7,S9 | delegated | Desktop: electron-builder config, asarUnpack for sharp, portable targets | done | `016bf49` |
| D4 | S8,S9 | inline | Desktop: Build AppImage and verify packaged app end-to-end | done | — |

---

## Log

**L1 (2026-10-18):** User request — "Comienza un proyecto utilizando ODD, el cual conste de una automatizacion que busque imagenes de una determinada carpeta y ajuste su resolucion a la que un usuario ingrese, y luego las guarde en otra carpeta, por ello debe tener un apartado frontend (que deberas hacerlo con el stack que creas mas conveniente), y deberas utilizar las herramientas que creas mas eficientes para este tipo de automatizacion. Como utilizaras ODD, deberas generar el SPEC.md general que tenga un breve resumen de la automatizacion, el objetivo principal y luego contexto general de todo el proyecto."

**L3 (2026-10-23):** User request — "Haz que el frontend este en espanol." All user-facing copy translated to neutral professional Spanish (labels, buttons, statuses, validation messages, empty states, `index.html` lang/title/description). Technical identifiers, comments, `data-testid` values, CSS classes and the Sharp `inside`/`fill` API values remain in English. Tests updated one-for-one to the new copy; 24/24 Vitest and `vite build` pass.

**L2 (2026-10-23):** Implementación completa. T1 (`5a34435`) pipeline Sharp + Express; T2 (`f545212`) WebSocket con RunManager y heartbeat; T3 (`5a280f8`) errores estructurados con `PipelineError`; T4 (`d39353c`) endpoints `GET/PUT /api/config` (el módulo de config existía pero no estaba expuesto por HTTP — hueco cerrado); T5 (`005afbe`) panel React + Vite + Tailwind.

**Verificación final (2026-10-23):** backend 35/35 tests Jest; frontend 24/24 tests Vitest; `vite build` OK. Smoke test end-to-end contra el servidor real: 2 imágenes procesadas, `broken.png` reportado como `CORRUPT_FILE`, archivo oculto y `.txt` ignorados, eventos WS `started → progress×2 → error → done`, dimensiones de salida correctas (`400×267` en modo `inside`, `400×300` en modo `fill` con `10.16×7.62 cm @ 100 dpi`).

**Decisión de stack (2026-10-18):**
- **Backend:** Node.js + Express + Sharp + Chokidar (fs watcher) + `ws` (WebSocket). Sharp es la librería más eficiente para redimensionamiento en Node.js — usa libvips en C, mucho más rápido que soluciones JS puras.
- **Frontend:** React + Vite + Tailwind CSS. Vite por su velocidad de desarrollo, Tailwind por UI rápida sin overhead de CSS manual, React por su ecosistema maduro para paneles de control.
- **Tests:** Jest + Supertest (backend), Vitest + Testing Library (frontend).
- **Sin base de datos:** la configuración persiste en JSON en disco; no hay estado relacional.

**L4 (2026-10-23):** User request — "Haz un plan detallado para que la Geometria se ponga en cm, no en pixeles, luego en el apartado de carpetas, debe haber un boton para poder seleccionar la carpeta."

**Decisión de DPI (2026-10-23):** la resolución es un campo configurable del formulario, con default `300` y rango `1..1200`. Se descartó fijarla en código porque el tamaño físico de destino varía por trabajo (pantalla 96, impresión 300, gran formato 150).

**Por qué la conversión vive en el borde (2026-10-23):** `src/pipeline/resize.js` queda como función pura de píxeles y `orchestrator.js` convierte cm→px antes de llamarla. Así el pipeline conserva sus tests en píxeles y la aritmética nueva se prueba una sola vez, aislada, en `src/units/cm.js` (con un espejo ESM en el frontend cuyos tests fijan los mismos valores de referencia para que no deriven).

**Migración de config (2026-10-23):** renombrar `width`/`height` a `widthCm`/`heightCm` fue deliberado. Sin el renombre, una config legacy `{"width": 800}` se habría leído como 800 cm (~9449 px). Con `schemaVersion: 2` la ambigüedad desaparece, y un archivo sin versión se migra a cm usando 300 DPI y se reescribe en disco. Una config que ya trae `widthCm`/`heightCm` pero sin `schemaVersion` conserva sus centímetros en lugar de caer a los defaults.

**Verificación final T6-T8 (2026-10-23):** backend 82/82 tests Jest (9 suites); frontend 44/44 tests Vitest (7 archivos); `vite build` OK. Verificador independiente sobre el rango `9d5e0fa..ae4c9b2`: S1-S8 PASS, sin blockers, con tres advisories corregidas en `e36ba59` (config en cm sin `schemaVersion`, validación de geometría en `PUT /api/config` con 400 y archivo intacto, y voseo reemplazado por español neutro). Sondas confirmadas: `cmToPx(10,300)=1181`, migración legacy `800×600 px → 6.77×5.08 cm @ 300 dpi`, salida real `400×267` (inside) y `400×300` (fill) con `10.16×7.62 cm @ 100 dpi`, `initialPath` con `;`, `$()` y backticks pasado como elemento inerte de un array a `execFile`, y bind observado en `127.0.0.1`.

**L5 (2026-10-24):** Portable desktop packaging with Electron (`feature/electron-portable`).
- D1 (`7108b70`): `createApp` accepts `staticDir`, path-less SPA fallback after `/api` routes, `start()` forwards `staticDir` and `pickFolder`. Backend 93/93.
- D2 (`afcfec7`): `desktop/main.js` (single-instance lock, `port: 0`, userData config, window `show: false` + `ready-to-show`, `nodeIntegration: false`/`contextIsolation: true`/`sandbox: true`, close server on `before-quit`), `desktop/pickFolder.js` (`createElectronPicker` wraps `dialog.showOpenDialog` with conditional call shape). Backend 101/101, frontend 44/44.
- D3 (`016bf49`): `electron-builder.yml` with `appId: com.alejoba.ajuste-resolucion`, `productName: Ajuste de Resolucion`, `executableName: ajuste-de-resolucion`, `syncDesktopName: true`, `asar: true`, `asarUnpack: ['**/node_modules/sharp/**', '**/node_modules/@img/**']`, `npmRebuild: false`, targets AppImage/portable/dmg+zip.
- D4 (inline): Built AppImage `Ajuste de Resolucion-1.0.0-x86_64.AppImage` (137M). End-to-end verified: `GET /api/config` → schema v2; `GET /` → SPA; `POST /api/process` with 2 fixtures at 10cm×7.5cm@300dpi → outputs 1181×787 and 886×886 JPEG; userData at `~/.config/Ajuste de Resolucion/`; no `config.json` next to executable; runs with `PATH=/usr/bin:/bin` (no system Node).
- Suites green: Jest 12/12 (101 tests), Vitest 7/7 (44 tests).
- Known: AppImage needs `libfuse2` for direct launch (use `--appimage-extract-and-run` or install `libfuse2`); Wayland/Vulkan error cosmetic; SharpElectronLinux advisory accepted; @img multi-platform binaries add ~40MB.

**Decisión de stack para empaquetado (2026-10-23):** Electron sobre Tauri y Node SEA. Electron reutiliza el backend Node sin cambios y reemplaza `zenity`/`osascript`/PowerShell por un solo `dialog.showOpenDialog` por plataforma. Tauri habría requerido reescribir el backend en Rust; Node SEA no tiene diálogos nativos ni empaquetado multiplataforma maduro.
